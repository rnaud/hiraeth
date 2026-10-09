// The attack-pattern library (docs/design/enemy-roster.md, "Retired, and why"): the fifteen patterns the 100 world
// enemies fought with (they are retired as kinds; src/enemies/archetypes.js replaces them). The archetypes draw
// on these through fromPattern() (src/enemies/archetypes.js): the numbers here are a pattern's shape, timing and
// harm; an archetype's attack takes them and adds its own (min, max, what answers it).
//
// Every pattern uses a locked aim, explicit contact instants and a punishable recovery. The warning is the body's
// (src/telegraph.js: the motion's pose, a glow on the striking limb, a rising sound); only the lobbed globs (`lob`)
// mark where they land on the ground. damage: hearts per contact (an ordinary attack half a heart in all:
// docs/systems/foes.md). contacts: the strike's instants (0..1); offsets: each contact's turn off the aim (rad).
export const ATTACKS = {
  pincer: { name:'Crossing pincers', shape:'cone', range:2.7, angle:.65, wind:.85, strike:.65, contacts:[.36,.8], offsets:[-.35,.35], damage:0.25, motion:'claw', recover:1.25 },
  rush: { name:'Committed rush', shape:'lane', range:6, width:1.45, wind:1.1, strike:.7, contacts:[.72], lunge:4.6, damage:0.75, motion:'charge', recover:1.65 },
  peck: { name:'Spear peck', shape:'lane', range:3.6, width:.85, wind:.75, strike:.34, contacts:[.55], damage:0.5, motion:'peck', recover:1.1 },
  tail: { name:'Tail sweep', shape:'cone', range:3.7, angle:1.45, wind:1.15, strike:.5, contacts:[.6], damage:0.75, motion:'sweep', recover:1.4 },
  sweep: { name:'Scything sweep', shape:'cone', range:3.3, angle:1.2, wind:1, strike:.7, contacts:[.35,.8], offsets:[-.55,.55], damage:0.25, motion:'sweep', recover:1.45 },
  stomp: { name:'Groundbreaker', shape:'ring', radius:3.1, wind:1.35, strike:.45, contacts:[.65], damage:1, knock:6, motion:'slam', recover:1.8 },
  lob: { name:'Arcing glob', shape:'ring', at:'target', lob:true, radius:1.65, wind:1.3, strike:.75, contacts:[.9], damage:0.5, motion:'lob', recover:1.5 },
  volley: { name:'Three-shot barrage', shape:'ring', at:'target', lob:true, radius:1.05, spread:2.5, wind:1.5, strike:1.2, contacts:[.38,.65,.92], damage:0.25, motion:'lob', recover:1.7 },
  jet: { name:'Pressure jet', shape:'lane', range:7, width:1.25, wind:1.15, strike:.8, contacts:[.22,.5,.8], damage:0.25, knock:2, motion:'jet', recover:1.5 },
  beam: { name:'Focused beam', shape:'lane', range:10, width:1.0, wind:1.45, strike:.55, contacts:[.55], damage:0.75, motion:'beam', recover:1.8 },
  pulse: { name:'Expanding pulse', shape:'ring', radius:4.3, wind:1.4, strike:.7, contacts:[.8], damage:0.75, knock:4, motion:'pulse', recover:1.65 },
  pull: { name:'Drawing current', shape:'cone', range:6, angle:.65, wind:1.3, strike:.65, contacts:[.6], damage:0.5, pull:4.5, motion:'pull', recover:1.65 },
  dive: { name:'Diving pass', shape:'lane', range:7, width:1.75, wind:1.25, strike:.75, contacts:[.72], lunge:5.5, dive:true, damage:0.75, motion:'dive', recover:2 },
  gust: { name:'Wing buffet', shape:'cone', range:5, angle:.9, wind:1.2, strike:.6, contacts:[.65], damage:0.5, knock:5, motion:'gust', recover:1.4 },
  sting: { name:'Needle thrust', shape:'lane', range:4.5, width:.7, wind:.95, strike:.4, contacts:[.65], lunge:1.3, damage:0.5, motion:'peck', recover:1.25 },
};

/**
 * An attack from the library in the foes' own shape (src/foe-kinds.js says what an attack may hold): the pattern's
 * area, timing, harm and knock, its first contact as the moment it lands; `o` adds or overrides (the id, min, max…).
 */
export function fromPattern(id, o = {}) {
  const p = ATTACKS[id];
  if (!p) throw new Error(`no attack pattern ${id}`);
  const a = { pattern: id, shape: p.shape, damage: p.damage, wind: p.wind, strike: p.strike, contact: p.contacts?.[0] ?? 0.55, recover: p.recover };
  for (const k of ['range', 'angle', 'width', 'radius', 'knock', 'lunge', 'at', 'dive']) if (p[k] !== undefined) a[k] = p[k];
  if (p.lob) { a.lob = true; a.instant = true; }
  return { ...a, ...o };
}
