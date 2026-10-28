// The encounter sites (issue #722, "encounters as places"; docs/systems/foes.md, "Encounter sites"): in every world on
// the route, a few places where the foes live instead of wandering in round you. Each is built from the world's own
// archetypes (src/foe-worlds.js WORLDS) on the world's own ground, off its paths, clear of its doors, its people, the
// ship's landing and its temples (tests/encounters.test.js measures all of it), and each pays when it is cleared: the
// foes' coffer (src/encounters/index.js), better than a wandering pack's drops.
//
// The kinds of site (layoutSite lays each out round its centre, `heading` its front, the side you come from):
//
//   camp     a fire with stones and logs round it; the foes sit round it facing the flames, a lookout stands off to the
//            front watching the way in (it sees you first and the camp wakes with it). The coffer behind the fire.
//            The fire is the world's (src/flammable.js: an ember flares it; a foe knocked into it burns, and so do you)
//            and dry brush stands round the camp (fire runs through it: src/chemistry.js).
//   nest     a ring of stones and old bones; the foes asleep in it round the coffer. Asleep, one takes a sneak strike.
//   hoard    a coffer in the open with its guards before it, facing out, turning to look about.
//   ambush   a coffer alone, the bait; a sign before it (the sand twitching, or a shadow on the ground), and the foes come
//            up round you when you step in to take it.
//   patrol   a coffer by a cairn; the foes walk a beat before it, end to end, and back.
//   warlord-hold  a warlord's own place (issue #726, roster v4): it stands guard before its coffer between two banners,
//            its glaive grounded; its band sits round a fire before it. Its roar (attack.horn) wakes the band. One a world
//            from the second (Vael) on.
//
// SITES[world]: [{ id, kind, at: [x, y, z] (world metres: y its ground), heading (rad, its front), foes: [archetype …],
// lookout?: archetype (a camp's), sign?: 'sand' | 'shadow' (an ambush's), beat?: m (a patrol's half-length), rack?: true
// (a camp's weapon rack), unarmed?: n (that many of its rack-takers start empty-handed) }]. A
// merged world lists its parts' sites in its own coordinates (src/levels/names.js PART_OFFSET); each site's foes are
// the archetypes of the part it stands in (level.foes.partAt). Pure: no three.js here.
//
// Since roster v4 (issue #726, docs/design/enemy-roster-v4.md "Where they live") the same foes keep the same kind of place
// in every world: a camp is grunts round the fire with a hulk, a lookout grunt and their weapon rack; a nest or an ambush
// prowlers; a hoard or a patrol (the ruins, the makers' places) droids: the sentinel, the oracle, crawlers, with the
// fencer and the lamp tripod where they were; and from the second world on one site a world is a warlord's hold. Each
// site kept its place and its kind (a hold took the world's hoard, or a patrol or a nest where it had none); its foes grow
// with the world's stage, and its id names what holds it now (a save's cleared flag was the old foes').

/** The tuning: near (m) the foes come out; quiet (m) round an uncleared site no wandering pack comes in; build (m) its things are made. */
export const SITE = { near: 70, quiet: 110, build: 160, trigger: 7.5, wake: [0.25, 0.9], drop: 85 };
/** The coffer's purse by the world's stage (chimes): a wandering pack's whole drop is 2–20; a site pays more. */
export const SITE_PURSE = [20, 25, 30, 40, 50];
/** The idle each kind of site gives its foes (src/encounters/idle.js), and its lookout's. */
export const SITE_IDLE = { camp: 'sit', nest: 'sleep', hoard: 'guard', ambush: 'hidden', patrol: 'patrol', 'warlord-hold': 'guard' };
/** A site of this kind pays its coffer's purse this many times over (the warlord's hold: the rare elite's). */
export const SITE_PAYS = { 'warlord-hold': 2 };

/** The save's flags: the site cleared (its foes cut down, for good), its coffer opened (src/chimes.js connectDrops). */
export const siteFlag = (world, id) => `site.${world}.${id}`;
export const cofferFlag = (world, id) => `res.site.${world}.${id}`;

const rot = (h, x, z) => [x * Math.cos(h) + z * Math.sin(h), -x * Math.sin(h) + z * Math.cos(h)];

/**
 * A site laid out round its centre: { foes: [{ archetype, at: [x, z], heading, idle, face?, path? }], props: [{ type,
 * at: [x, z], heading, r? }], coffer: { at, heading }, trigger? }. `hovers(archetype)`: does it fly (a hovering foe
 * circles at its post instead of sitting or sleeping)? `radius(archetype)`: its body's (a toad's or a brute's wider ring
 * round the fire or the coffer, so no body stands in another or in the coffer). Local x is to the right of the front, z
 * toward it.
 */
export function layoutSite(s, { hovers = () => false, radius = () => 0.6, racks = () => false } = {}) {
  const h = s.heading ?? 0, [cx, , cz] = s.at;
  const W = (x, z) => { const [dx, dz] = rot(h, x, z); return [+(cx + dx).toFixed(2), +(cz + dz).toFixed(2)]; };
  const toward = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
  const foes = [], props = [];
  const idleOf = (a, mode) => (hovers(a) && (mode === 'sit' || mode === 'sleep') ? 'orbit' : mode);
  const n = s.foes.length;
  let coffer;
  if (s.kind === 'camp') {
    props.push({ type: 'fire', at: W(0, 0), heading: h });
    // (a bigger camp sits in a wider ring: a hulk's, the Market's five, #726)
    const big = Math.max(...s.foes.map(radius)), R = 2.3 + big + Math.max(0, n - 5) * 0.45;
    s.foes.forEach((a, i) => {
      // round the fire, the front left open (the way in), each facing the flames
      const ang = Math.PI * (0.45 + (1.1 * (i + 0.5)) / n) + Math.PI, at = W(Math.sin(ang) * R, Math.cos(ang) * R);
      foes.push({ archetype: a, at, heading: toward(at, W(0, 0)), idle: idleOf(a, 'sit'), face: W(0, 0) });
      // a log between each two of them, out behind the ring (they sit on the ground by the fire, the logs their backs')
      const la = ang + (0.55 * Math.PI) / n;
      if (i < n - 1 || n === 1) props.push({ type: 'log', at: W(Math.sin(la) * (R + big + 0.8), Math.cos(la) * (R + big + 0.8)), heading: h + la + Math.PI / 2 });
    });
    if (s.lookout) { const at = W(3.2, 8); foes.push({ archetype: s.lookout, at, heading: h, idle: idleOf(s.lookout, 'lookout') }); props.push({ type: 'post', at: W(4.4, 8.4), heading: h }); }
    coffer = { at: W(0, -5.2), heading: h };
    // (a weapon rack by the way in: the grunts' bow and spear, src/foes.js RACK)
    if (s.rack) props.push({ type: 'rack', at: W(-4.4, 3.4), heading: h + 0.5 });
    // (who starts empty-handed, to run for the rack: the first `unarmed` of the kinds that take from it)
    if (s.unarmed) { let k = s.unarmed; for (const f of foes) if (k > 0 && racks(f.archetype)) { f.weapon = 'none'; k--; } }
    for (let i = 0; i < 4; i++) { const ang = Math.PI + (i - 1.5) * 0.55; props.push({ type: 'bramble', at: W(Math.sin(ang) * 8, Math.cos(ang) * 8), heading: i * 1.7 }); }
  } else if (s.kind === 'nest') {
    props.push({ type: 'nest', at: W(0, 0), heading: h, r: 3.4 });
    s.foes.forEach((a, i) => {
      // round the coffer, clear of it and of each other (a flock in two rings)
      const ang = (i / n) * Math.PI * 2 + 0.4, r = n > 4 ? 1.6 + (i % 2) * 0.7 : 1.25 + radius(a) * 1.3, at = W(Math.sin(ang) * r, Math.cos(ang) * r);
      foes.push({ archetype: a, at, heading: h + ang + Math.PI * 0.6, idle: idleOf(a, 'sleep') });
    });
    coffer = { at: W(0, 0), heading: h };
  } else if (s.kind === 'hoard') {
    coffer = { at: W(0, -1), heading: h };
    props.push({ type: 'cairn', at: W(-1.8, -2.2), heading: h }, { type: 'post', at: W(1.9, -2.4), heading: h });
    s.foes.forEach((a, i) => {
      const x = n === 1 ? 0 : -2.6 + (5.2 * i) / (n - 1), at = W(x, 2.6 + (i % 2) * 0.8);
      foes.push({ archetype: a, at, heading: h + x * 0.12, idle: idleOf(a, 'guard') });
    });
  } else if (s.kind === 'ambush') {
    coffer = { at: W(0, 0), heading: h };
    props.push({ type: s.sign ?? 'sand', at: W(0, 3.2), heading: h });
    s.foes.forEach((a, i) => {
      // where each comes up, round the coffer (out of the sand, out of the shadow): the side you came from too
      const ang = (i / n) * Math.PI * 2 + 0.6, at = W(Math.sin(ang) * 4.6, Math.cos(ang) * 4.6);
      foes.push({ archetype: a, at, heading: toward(at, W(0, 0)), idle: 'hidden' });
    });
  } else if (s.kind === 'patrol') {
    const L = s.beat ?? 11;
    coffer = { at: W(0, -3.5), heading: h };
    props.push({ type: 'cairn', at: W(-1.6, -4.6), heading: h }, { type: 'cairn', at: W(-L, 0), heading: h }, { type: 'cairn', at: W(L, 0), heading: h });
    s.foes.forEach((a, i) => {
      // in single file along the beat, a few metres apart, walking it end to end
      const path = [W(-L + 1.2, 0.6 * (i % 2)), W(L - 1.2, 0.6 * (i % 2))], at = W(-L * 0.4 + i * 3, 0.6 * (i % 2));
      foes.push({ archetype: a, at, heading: h + Math.PI / 2, idle: idleOf(a, 'patrol'), path });
    });
  } else if (s.kind === 'warlord-hold') {
    // the warlord before its coffer between its two banners, looking out down the way in; its band round a fire before
    // it, off to one side (each facing the flames), so the way to it is open
    coffer = { at: W(0, -2.4), heading: h };
    props.push({ type: 'banner', at: W(-2.3, -1.6), heading: h }, { type: 'banner', at: W(2.3, -1.6), heading: h }, { type: 'fire', at: W(-3.4, 3.6), heading: h });
    const [lord, ...band] = s.foes;
    foes.push({ archetype: lord, at: W(0, 0.3), heading: h, idle: idleOf(lord, 'guard') });
    const big = Math.max(0.6, ...band.map(radius)), R = 1.6 + big;
    band.forEach((a, i) => {
      const ang = Math.PI * (0.15 + (1.3 * (i + 0.5)) / Math.max(1, band.length)), c = [-3.4, 3.6], at = W(c[0] + Math.sin(ang) * R, c[1] + Math.cos(ang) * R);
      foes.push({ archetype: a, at, heading: toward(at, W(...c)), idle: idleOf(a, 'sit'), face: W(...c) });
    });
  } else throw new Error(`a site of no kind: ${s.kind}`);
  return { foes, props, coffer, trigger: s.kind === 'ambush' ? SITE.trigger : null };
}

/** Everything a site puts on the ground, as [x, z] points with the room each needs (m): what the tests stand on the world. */
export function siteFootprint(s, o) {
  const L = layoutSite(s, o);
  return [...L.foes.map((f) => ({ at: f.at, r: 1, what: `${f.archetype} (${f.idle})` })), ...L.props.map((p) => ({ at: p.at, r: p.type === 'nest' ? 3.4 : p.type === 'fire' ? 1.4 : p.type === 'rack' || p.type === 'banner' ? 0.9 : 0.6, what: p.type })), { at: L.coffer.at, r: 0.9, what: 'coffer' }];
}

// ------------------------------------------------------------------ the sites, world by world
// (placed with the world's own ground, its paths, doors and people measured round them: the 722-sites finder, then each
// looked at in the running game; see tests/encounters.test.js for what every one must keep clear of)
export const SITES = {
  // (issue #726, roster v4: each site where it was, its foes the same everywhere; the old ones' ids in the comments)
  desert: [
    // (the mummers' camp, #724: grunts round the fire with a hulk, their rack by the way in; issue #738: moved off the
    // salt pan, which floods when the tree drinks, onto the sand east of it)
    { id: 'grunt-camp', kind: 'camp', at: [361, 15.7, 202], heading: -0.49, foes: ['grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 1 },
    { id: 'twitching-sand', kind: 'ambush', at: [515, 37.4, 288], heading: -0.51, foes: ['prowler'], sign: 'sand' },
    { id: 'prowler-nest', kind: 'nest', at: [263, 1.2, 309], heading: -1.18, foes: ['prowler', 'prowler'] },   // (the skitter nest)
    { id: 'droid-hoard', kind: 'hoard', at: [354, 0.5, 456], heading: -3, foes: ['crawler', 'sentinel', 'crawler'] },   // (the heron hoard)
  ],
  arzach: [
    { id: 'grunt-camp', kind: 'camp', at: [-68, 52, -1457], heading: 0.37, foes: ['grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 1 },   // (the plain fire)
    { id: 'prowler-shadow', kind: 'ambush', at: [-460, 62.5, -1100], heading: 1.52, foes: ['prowler', 'prowler'], sign: 'shadow' },   // (the ray shadow)
    // (the crab nest: Vael's droids asleep, dormant, round the coffer under the makers' stones)
    { id: 'droid-nest', kind: 'nest', at: [51, 40.5, -43], heading: -2.73, foes: ['crawler', 'sentinel', 'crawler'] },
    // (the stone hoard: the warlord's hold, where it was staged first, v2.34)
    { id: 'stone-hold', kind: 'warlord-hold', at: [-278, 76.2, -162], heading: 2.34, foes: ['warlord', 'grunt', 'grunt'] },
  ],
  perdide: [
    { id: 'grunt-camp', kind: 'camp', at: [-133, 1.6, 194], heading: -2.54, foes: ['grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 1 },   // (the toad fire)
    { id: 'prowler-nest', kind: 'nest', at: [-231, 1.6, 166], heading: 2.15, foes: ['prowler', 'prowler'] },   // (the skitter nest)
    { id: 'droid-beat', kind: 'patrol', at: [-77, 0.4, -646], heading: 1.29, foes: ['sentinel', 'crawler'] },   // (the shade beat)
    { id: 'prowler-shadow', kind: 'ambush', at: [-77, 0.4, -891], heading: 0.99, foes: ['prowler', 'prowler'], sign: 'shadow' },   // (the moth shadow)
    { id: 'root-hold', kind: 'warlord-hold', at: [-70, -1.1, -485], heading: 1.24, foes: ['warlord', 'grunt', 'grunt'] },   // (the root hoard)
  ],
  edena: [
    { id: 'grunt-camp', kind: 'camp', at: [152, 18.1, 356], heading: -2.5, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the blot fire)
    { id: 'warlord-hold', kind: 'warlord-hold', at: [61, 18.1, 342], heading: 2.2, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the brute hoard)
    { id: 'prowler-shadow', kind: 'ambush', at: [-2, 6.4, 83], heading: 2.46, foes: ['prowler', 'prowler'], sign: 'shadow' },   // (the moth shadow)
    { id: 'droid-beat', kind: 'patrol', at: [68, -6, -274], heading: -0.6, foes: ['sentinel', 'oracle', 'crawler'] },   // (the brute beat)
  ],
  underwater: [
    { id: 'prowler-nest', kind: 'nest', at: [-140, -0.6, -138], heading: 0.85, foes: ['prowler', 'prowler', 'prowler'] },   // (the crab nest)
    { id: 'droid-hoard', kind: 'hoard', at: [-77, -0.5, 107], heading: 1.63, foes: ['tripod', 'oracle', 'sentinel'] },   // (the tripod hoard)
    { id: 'beat-hold', kind: 'warlord-hold', at: [-63, -0.4, -194], heading: 1.32, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the crab beat)
    { id: 'prowler-shadow', kind: 'ambush', at: [91, -0.5, 135], heading: -2.08, foes: ['prowler', 'prowler'], sign: 'shadow' },   // (the ray shadow)
  ],
  incal: [
    { id: 'grunt-camp', kind: 'camp', at: [262, 200, 189], heading: -2.17, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the lizard fire)
    { id: 'droid-beat', kind: 'patrol', at: [276, 200, -119], heading: 0.26, foes: ['sentinel', 'tripod', 'crawler'] },   // (the shade beat)
    { id: 'warlord-hold', kind: 'warlord-hold', at: [402, 200, 35], heading: -1.47, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the tripod hoard)
    { id: 'prowler-nest', kind: 'nest', at: [360, 200, -105], heading: -0.85, foes: ['prowler', 'prowler', 'prowler'] },   // (the toad nest)
  ],
  glassdunes: [
    { id: 'grunt-camp', kind: 'camp', at: [175, 0.4, 62], heading: -1.32, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the brute fire)
    { id: 'twitching-sand', kind: 'ambush', at: [126, 1, 174], heading: -2.03, foes: ['prowler', 'prowler', 'prowler'], sign: 'sand' },
    { id: 'warlord-hold', kind: 'warlord-hold', at: [-84, 0, 209], heading: 1.88, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the shade hoard)
    // (the crab nest: the droids asleep, dormant, round the coffer; the oracle wakes the rest)
    { id: 'droid-nest', kind: 'nest', at: [35, 1.2, 293], heading: -2.99, foes: ['sentinel', 'crawler', 'oracle', 'crawler'] },
  ],
  buried: [
    { id: 'grunt-camp', kind: 'camp', at: [156, 13.5, -180], heading: -1.26, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the lizard fire)
    { id: 'twitching-sand', kind: 'ambush', at: [-117, 10.7, 9], heading: 0.87, foes: ['prowler', 'prowler', 'prowler'], sign: 'sand' },
    { id: 'droid-nest', kind: 'nest', at: [135, 3.9, -96], heading: -2.06, foes: ['sentinel', 'crawler', 'oracle', 'crawler'] },   // (the skitter nest)
    { id: 'beat-hold', kind: 'warlord-hold', at: [-166, 7.9, 100], heading: 1.2, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the cart beat)
  ],
  moonfoundry: [
    { id: 'grunt-camp', kind: 'camp', at: [-145, 0, -86], heading: 1.09, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the fencer fire)
    { id: 'warlord-hold', kind: 'warlord-hold', at: [-131, 0, -2], heading: 2.11, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the brute hoard)
    { id: 'droid-beat', kind: 'patrol', at: [149, 0, 159], heading: -2.77, foes: ['fencer', 'sentinel', 'crawler'] },   // (the fencer beat)
    { id: 'prowler-nest', kind: 'nest', at: [177, 0, -184], heading: -0.94, foes: ['prowler', 'prowler', 'prowler'] },   // (the skitter nest)
  ],
  spheres: [
    { id: 'prowler-nest', kind: 'nest', at: [-58, 0, -650], heading: 1.09, foes: ['prowler', 'prowler', 'prowler'] },   // (the centipede nest)
    { id: 'grunt-camp', kind: 'camp', at: [-170, 0.7, 260], heading: -2.28, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the roller fire)
    { id: 'warlord-hold', kind: 'warlord-hold', at: [-198, -0.3, 15], heading: 3.11, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the centipede hoard)
    { id: 'droid-beat', kind: 'patrol', at: [40, 0.1, -146], heading: -1.63, foes: ['sentinel', 'oracle', 'crawler'] },   // (the shade beat)
    { id: 'prowler-shadow', kind: 'ambush', at: [-65, 1.7, -440], heading: 1.61, foes: ['prowler', 'prowler', 'prowler'], sign: 'shadow' },   // (the puppet shadow)
  ],
  spacecity: [
    { id: 'droid-hoard', kind: 'hoard', at: [78, 24.4, -182], heading: 1.01, foes: ['fencer', 'crawler', 'crawler'] },   // (the fencer hoard)
    { id: 'prowler-shadow', kind: 'ambush', at: [111, 24.4, -191], heading: -0.63, foes: ['prowler', 'prowler', 'prowler'], sign: 'shadow' },   // (the moth shadow)
    { id: 'nest-hold', kind: 'warlord-hold', at: [-69, 0.3, 37], heading: 1.06, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the roller nest)
  ],
  bazaar: [
    { id: 'grunt-camp', kind: 'camp', at: [-94, 0, 0], heading: 1.59, foes: ['grunt', 'grunt', 'hulk', 'grunt'], lookout: 'grunt', rack: true, unarmed: 2 },   // (the lizard fire)
    { id: 'warlord-hold', kind: 'warlord-hold', at: [-73, 0, -294], heading: 1.12, foes: ['warlord', 'grunt', 'grunt', 'grunt'] },   // (the bell hoard)
    { id: 'prowler-nest', kind: 'nest', at: [88, 0, -168], heading: -0.25, foes: ['prowler', 'prowler', 'prowler'] },   // (the lizard nest)
    { id: 'droid-beat', kind: 'patrol', at: [116, 0, 70], heading: -2.73, foes: ['sentinel', 'crawler', 'oracle'] },   // (the fencer beat)
    { id: 'prowler-shadow', kind: 'ambush', at: [158, 0, -84], heading: -1.36, foes: ['prowler', 'prowler', 'prowler'], sign: 'shadow' },   // (the puppet shadow)
  ],
};

/** A world's sites (the route's worlds; none anywhere else). */
export const sitesOf = (world) => SITES[world] ?? [];
