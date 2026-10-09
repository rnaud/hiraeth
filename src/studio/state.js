// The character studio's settings (studio.html): one plain object, kept in the
// URL's query string so a look can be bookmarked or sent, and copied as JSON to
// paste tuned values into the code. Only what differs from DEFAULTS is written.
//
//   top-level keys          ?who=npc&world=bazaar&npc=sel
//   groups (one letter)     body morph b.*, face morph f.*, costume pieces l.*,
//                           colours c.*, expression e.*  (?f.eyeSize=1.2&c.skin=%23c58c64)

export const DEFAULTS = Object.freeze({
  who: 'traveller',      // traveller | npc | crowd | blank
  world: 'desert',       // the costume world, its people and its sky
  npc: '',               // a story person's id (who=npc; '' the world's first)
  seed: 1,               // a crowd person's seed (who=crowd)
  kind: 'm',             // m | f (blank bodies; crowd: '' = as seeded)
  spot: '',              // where they stand, for worlds dressed by it (the City-Shaft: rim | upper | middle | lower)
  build: '',             // '' the person's own, else slim | average | broad | heavy
  source: 'quaternius',  // the body: quaternius (the game's) | makehuman (the prototype, src/studio/makehuman.js)
  mh: '',                // a MakeHuman person's id (source=makehuman; '' the first of the person's kind)
  // the expression: a dialogue tone, how much of it, talking (the mouth moves), blinking
  tone: 'neutral', amount: 1, talk: false, blink: true,
  gaze: 'camera',        // camera | target | free | fixed (e.gazeX / e.gazeY)
  // animation
  anim: 'game:idle',     // game:idle | game:walk | game:jog | game:run | game:talk | game:sit | clip:<name>
  speed: 1, paused: false, time: 0, plant: true, move: false,
  hands: 'auto',         // auto (by the motion, the prop and the tone) | a pose of src/hands.js HAND_POSES
  // cloth
  cape: true, wind: 0.6, backpack: false,
  // the blade and the shield (with the backpack; src/blade-grip.js): the hilt in the fist, the blade lit,
  // the shield open by `shield` (0 folded on the wrist .. 1 open) and how it is hit (block | parry | broken)
  sword: false, lit: 1, shield: 0, guard: '',
  draw: 0,               // the draw from the back (0 the sword on his back, or in the fist with `sword`; between: that share of the draw, src/sword-sheath.js)
  // the view
  view: 'full',          // full | bust | face | close | far | hands
  turntable: false, yaw: 0.35, pitch: 0.05,
  lineup: '',            // '' | cast | crowd | faces (the traveller and someone of every world) | makehuman (MakeHuman beside Quaternius)
  count: 6,
  twin: false,           // the GPU crowd figure of this person beside them
  // light and ink (hour -1: the world's own hour)
  hour: -1, sunTurn: 0, light: '', shadows: 'fine', bg: 'sky', bgColor: '#eee9de', ground: true,
  preset: 'world', debug: 0, hatch: true, scale: 1, subject: true,
  // groups
  b: {}, f: {}, l: {}, c: {}, e: {},
});

const GROUPS = ['b', 'f', 'l', 'c', 'e'];
const isGroup = (k) => GROUPS.includes(k);

/** A full state from a partial one (unknown keys dropped, types follow DEFAULTS). */
export function cleanState(s = {}) {
  const out = structuredClone(DEFAULTS);
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (!(k in s)) continue;
    const v = s[k];
    if (isGroup(k)) { out[k] = v && typeof v === 'object' ? { ...v } : {}; continue; }
    out[k] = cast(def, v);
  }
  return out;
}

function cast(def, v) {
  if (typeof def === 'number') { const n = Number(v); return Number.isFinite(n) ? n : def; }
  if (typeof def === 'boolean') return v === true || v === 'true' || v === '1' || v === 1;
  return String(v ?? def);
}
const groupValue = (v) => {
  if (typeof v !== 'string') return v;
  if (v === 'true' || v === 'false') return v === 'true';
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && !/^#/.test(v) ? n : v;
};

/** The query string for a state (only what differs from DEFAULTS). */
export function encodeState(s) {
  const c = cleanState(s);
  const p = new URLSearchParams();
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (isGroup(k)) {
      for (const [gk, gv] of Object.entries(c[k])) if (gv !== undefined && gv !== null && gv !== '') p.set(`${k}.${gk}`, String(gv));
    } else if (c[k] !== def) p.set(k, String(c[k]));
  }
  return p.toString();
}

/** A state from a query string (or URLSearchParams). */
export function decodeState(q) {
  const p = q instanceof URLSearchParams ? q : new URLSearchParams(q);
  const raw = {};
  for (const [k, v] of p) {
    const dot = k.indexOf('.');
    if (dot > 0 && isGroup(k.slice(0, dot))) (raw[k.slice(0, dot)] ??= {})[k.slice(dot + 1)] = groupValue(v);
    else raw[k] = v;
  }
  return cleanState(raw);
}

/** The settings worth pasting into the code: the person, their morphs, look and expression. */
export function settingsJSON(s, extra = {}) {
  const c = cleanState(s);
  const out = { who: c.who, world: c.world, ...(c.who === 'npc' ? { npc: c.npc } : {}), ...(c.who === 'crowd' ? { seed: c.seed } : {}), kind: c.kind };
  if (c.build) out.build = c.build;
  if (Object.keys(c.b).length) out.morph = c.b;
  if (Object.keys(c.f).length) out.face = c.f;
  if (Object.keys(c.l).length) out.look = c.l;
  if (Object.keys(c.c).length) out.palette = c.c;
  out.expression = { tone: c.tone, amount: c.amount, ...c.e };
  return JSON.stringify({ ...out, ...extra }, null, 2);
}
