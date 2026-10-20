// The combat review's pure part (.claude/skills/combat-review/SKILL.md; the Arena-driving script is
// .claude/skills/combat-review/arena.mjs; tests/combat-review.test.js). It reads whatever foe kinds and guardians the
// game has (the roster is growing: nothing here names a kind), turns the blade's and the gun's tuning into moves with a
// damage and a cycle time, and scores each foe on the rubric from its tuning and from what the Arena run measured.
// Every automatic score is a starting point the reviewer confirms or overrides by eye (the contact sheet, playing).

import { MERGED } from '../../src/levels/names.js';

/** The player's moves, from the tuning the game exports (src/fluid-blade.js, src/fluid-tool.js FLUID, src/fluid-kit.js MODES). */
export function movesFrom({ BLADE, SWINGS, CHARGE, AIR, RIPOSTE, DASH, FLUID, MODES }) {
  // a move's length as played: its authored phases (wind, active, recover: src/fluid-blade.js attackSample) when it has
  // them, else its clip's span (an older tuning)
  const span = (S) => (S.wind != null && S.active != null && S.recover != null ? S.wind + S.active + S.recover : (S.to ?? 0) - (S.from ?? 0));
  const combo = SWINGS.map(span), comboTime = combo.reduce((a, b) => a + b, 0) + BLADE.cooldown;
  const comboDamage = BLADE.damage.reduce((a, b) => a + b, 0);
  // the gun: `charges` shots a tank, each mode's cost (rate) out of it, `cooldown` s apart, then the refill's delay
  const gun = (mode) => {
    const per = Math.max(1, Math.floor(FLUID.charges / Math.max(0.05, MODES[mode]?.rate ?? 1)));
    const cycle = per * (FLUID.shoot?.cooldown ?? 0.3) + FLUID.refillDelay;
    return { cycle: cycle / per, burst: per };
  };
  return [
    { id: 'combo', label: 'light combo (3 swings)', mode: 'blade', damage: comboDamage / combo.length, hits: BLADE.damage.slice(), cycle: comboTime / combo.length, cycles: combo.map((c, i) => c + (i === combo.length - 1 ? BLADE.cooldown : 0)), cooldown: BLADE.cooldown, source: 'combo' },   // (cycles: each swing's own length, the cooldown after the third)
    { id: 'charge', label: 'charged cut (full)', mode: 'blade', damage: CHARGE.damage.at(-1), cycle: CHARGE.full + span(CHARGE), source: 'charge', breaks: true },
    { id: 'air', label: 'air cut', mode: 'blade', damage: AIR.damage, cycle: span(AIR) + 0.55, source: 'air' },   // (+ the jump's rise)
    { id: 'riposte', label: 'riposte (after a perfect parry)', mode: 'blade', damage: RIPOSTE.damage, cycle: span(RIPOSTE), source: 'riposte', stunned: true, gated: 'parry' },
    { id: 'dash', label: 'dash cut', mode: 'blade', damage: DASH.damage, cycle: Math.max(DASH.cooldown, span(DASH) + 0.3), source: 'dash' },
    { id: 'shoot', label: 'fluid shot', mode: 'shoot', damage: 0, cycle: gun('shoot').cycle, source: 'shoot' },
    { id: 'fire', label: 'ember', mode: 'fire', damage: 0, cycle: gun('fire').cycle, source: 'fire' },
    { id: 'push', label: 'push', mode: 'push', damage: 0, cycle: gun('push').cycle, source: 'push' },
  ];
}

/**
 * Hits to bring a foe down: `hit(i)` lands the i-th blow and says 'dead', 'hit', 'glance' (nothing) or false (it can't be
 * hit now); `max` blows at most. Returns { hits, landed, wasted, dead }.
 */
export function hitsToKill(hit, max = 40) {
  let landed = 0, wasted = 0;
  for (let i = 0; i < max; i++) {
    const r = hit(i);
    if (r === 'dead') return { hits: i + 1, landed: landed + 1, wasted, dead: true };
    if (r === 'hit') landed++; else wasted++;
  }
  return { hits: max, landed, wasted, dead: false };
}
/** Seconds to kill with a move: its blows times its cycle (a riposte also waits a parry: one of the foe's attack cycles). */
export const timeToKill = (r, move, attackCycle = 0) => {
  if (!r.dead) return null;
  // (a move with swings of their own lengths, the combo: those swings, without the cooldown after a last third swing)
  const own = move.cycles ? Array.from({ length: r.hits }, (_, i) => move.cycles[i % move.cycles.length]).reduce((a, b) => a + b, 0) - (r.hits % move.cycles.length === 0 ? move.cooldown ?? 0 : 0) : r.hits * move.cycle;
  return +(own + (move.gated ? r.hits * attackCycle : 0)).toFixed(2);
};

/**
 * A clapper-only foe's time to kill (the bell walker: only its opening takes harm, combat-v1.16 rec. 4): the blows fit
 * into openings of `r.opens` s each (as many as the move's cycle allows, at least one), and each opening costs one of
 * its attack cycles' wait for the drop that opens it. Anything else: `s` as it is.
 */
export const openingTime = (s, r, move, attackCycle = 3) => {
  if (s == null || !(r?.opens > 0)) return s;
  const cycle = move.cycles ? move.cycles.reduce((a, b) => a + b, 0) / move.cycles.length : move.cycle;
  const perOpening = Math.max(1, Math.floor(r.opens / Math.max(cycle, 1e-3))), openings = Math.ceil(Math.max(1, r.landed ?? r.hits) / perOpening);
  return +(s + openings * attackCycle).toFixed(2);
};

/** Scores 1..5 by thresholds (a value at or over t[i] gets i + 2; under t[0], 1). */
export const band = (v, t) => 1 + t.filter((x) => v >= x).length;
const clamp5 = (v) => Math.max(1, Math.min(5, Math.round(v)));

/**
 * A foe kind's facts from its def (src/foes.js FOES[kind], src/foe-kinds.js): telegraphs, how it is countered, how it
 * uses space and the kit. Works on any def with `attacks`.
 */
export function kindFacts(kind, D) {
  const attacks = D.attacks ?? [D.attack].filter(Boolean);
  const winds = attacks.filter((a) => !a.chain).map((a) => a.wind ?? 0);
  const ways = [];
  for (const [m, v] of Object.entries(D.takes ?? {})) if (v) ways.push(m);
  for (const k of Object.keys(D.weak ?? {})) ways.push(`weak:${k}`);
  for (const k of ['shell', 'burrow', 'phase', 'douse', 'splits', 'flinchy', 'breaks', 'heavy', 'metal', 'light', 'topples', 'segmented', 'flock', 'jams']) if (D[k]) ways.push(k);
  for (const a of attacks) if (a.onParry) ways.push(`parry:${a.onParry}`);
  // (what an attack leaves open: a shot in a toad's swollen throat, the air cut in its leap, the bell-note whistle on a
  // toll, the opening after a bell's drop, a wall that stalls a ram, the push on a ring or a heap, a jump over roots)
  for (const a of attacks) for (const k of ['choke', 'leap', 'whistle', 'opens', 'stall', 'encircle', 'pile', 'ground']) if (a[k]) ways.push(k);
  const space = ['clamber', 'perch', 'hover', 'keep', 'heavy', 'burrow', 'phase', 'trail'].filter((k) => D[k]);
  for (const a of attacks) {
    if (a.dive) space.push('dive');
    if (a.shape === 'lane') space.push('lane');
    if (a.wave) space.push('shockwave');
    if (a.spread) space.push('volley');
    if (a.at === 'target' && !a.encircle) space.push('lob');   // (a ring the body runs round you is a body attack, not a lob)
    if (a.lunge) space.push('lunge');
    for (const k of ['grab', 'tether', 'blind', 'leave', 'blink', 'surface', 'sweep', 'leap', 'encircle', 'reverse']) if (a[k]) space.push(k);
  }
  return {
    kind, name: D.name, hp: D.hp, speed: D.speed,
    attacks: attacks.map((a) => a.id ?? 'strike'),
    windMin: winds.length ? Math.min(...winds) : 0, windMax: winds.length ? Math.max(...winds) : 0,
    damageMax: Math.max(0, ...attacks.map((a) => Math.max(a.damage ?? 0, a.wave?.damage ?? 0))),
    ways: [...new Set(ways)], space: [...new Set(space)],
    tone: !!D.tone, sound: !!D.sound, role: D.keep || attacks.some((a) => a.at === 'target' && !a.encircle) ? 'ranged' : D.hover ? 'air' : D.heavy || D.hp >= 4 ? 'heavy' : D.light || D.group ? 'swarm' : 'melee',
  };
}

/**
 * The rubric for one foe (1..5 each). `run` is what the Arena measured for it (arena.mjs): { windSeen (s, median),
 * attacksPerMin, damagePerMin (a still player's health per minute), ttk: { move: s } }; `worlds`: how many world
 * rosters field it. The automatic scores, each with why.
 */
export function scoreKind(F, run = {}, worlds = 0, roleCount = 1) {
  const wind = run.windSeen ?? F.windMin;
  const readability = band(wind, [0.35, 0.5, 0.7, 0.95]);
  const counterplay = clamp5(1 + F.ways.length * 0.6 + (F.attacks.length - 1) * 0.6);
  const space = clamp5(1 + F.space.length * 0.8);
  // threat: how fast it hurts a player who does nothing (a still player in the Arena loses 1-3.5 bars a minute: v1.4);
  // fair: the time it gives to answer. A threat above what its telegraph lets you read costs fairness; no threat at
  // all is dull
  const dpm = run.damagePerMin ?? null;
  const threat = dpm === null ? 3 : band(dpm, [0.8, 1.4, 2.0, 2.8]);
  const fairness = dpm === null ? 3 : threat <= 1 ? 2 : clamp5(5 - Math.max(0, threat - readability));
  // identity: its own tone and more than one attack; the sounds are judged by ear (src/audio.js foeHurt / foeBurst
  // have two sets in v1.4: 'machine' and the ink's), the shape on the contact sheet
  const identity = clamp5(2 + (F.tone ? 1 : 0) + (F.attacks.length >= 2 ? 0.5 : 0) + (F.sound ? 0.5 : 0));
  const combines = clamp5(1 + Math.min(3, worlds) * 0.7 + (roleCount <= 2 ? 1 : 0.4));
  const total = +((readability + counterplay + space + fairness + identity + combines) / 6).toFixed(1);
  return {
    readability, counterplay, space, fairness, identity, combines, total, threat,
    why: {
      readability: `wind-up ${wind.toFixed(2)} s${run.windSeen ? ' seen' : ' (tuning)'}`,
      counterplay: `${F.ways.length} answers (${F.ways.join(', ') || 'the blade only'}), ${F.attacks.length} attacks`,
      space: F.space.join(', ') || 'flat ground only',
      fairness: dpm === null ? 'not measured' : `${dpm.toFixed(2)} health/min on a still player, threat ${threat}`,
      identity: `${F.tone ? 'own tone' : 'ink tone'}, ${F.sound ? `the ${F.sound} sound set` : 'the ink sound set'} (confirm on the contact sheet and by ear)`,
      combines: `${worlds} world rosters, role ${F.role}`,
    },
  };
}

/**
 * A temple guardian's facts (src/temples/<world>.js: KEEPER, ELDER …): its moves (a combo's links apart), its wind-ups
 * (body tells: src/telegraph.js), its combos, its openings (after a move, or when a move misses), its phases.
 */
export function guardianFacts(id, def) {
  const attacks = Object.entries(def.attacks ?? {});
  const own = attacks.filter(([, a]) => !a.link);
  const wind = (a) => a.wind ?? a.telegraph ?? 0;
  const tele = own.map(([, a]) => wind(a)), links = attacks.filter(([, a]) => a.link).map(([, a]) => wind(a));
  const shapes = [...new Set(attacks.map(([, a]) => a.shape))];
  const opens = attacks.filter(([, a]) => a.open).map(([, a]) => a.open);
  const combos = own.filter(([, a]) => a.then).map(([k]) => { const out = [k]; let n = def.attacks[k]; while (n?.then && out.length < 6) { out.push(n.then); n = def.attacks[n.then]; } return out; });
  const phases = (def.phases ?? []).filter((p) => !p.weary);
  return {
    id, name: def.name, kind: def.kind, phases: phases.length,
    attacks: own.map(([k]) => k), moves: attacks.length, shapes, teleMin: tele.length ? Math.min(...tele) : 0, teleMax: tele.length ? Math.max(...tele) : 0,
    linkMin: links.length ? Math.min(...links) : 0, combos: combos.length, comboLen: Math.max(0, ...combos.map((c) => c.length)),
    openMin: opens.length ? Math.min(...opens) : 0, misses: attacks.filter(([, a]) => a.miss).length,
    lobs: attacks.filter(([, a]) => a.lob).length, waves: attacks.filter(([, a]) => a.wave).length,
    floor: attacks.filter(([, a]) => a.tele || (a.at === 'player' && !a.lob && !a.over)).length,   // (drawn on the floor without being a lob: none wanted)
    newMoves: phases.slice(1).map((p, i) => p.attacks.filter((x) => !phases[i].attacks.includes(x)).length),
    damageMax: Math.max(0, ...attacks.map(([, a]) => a.damage ?? 0)),
    tracks: attacks.some(([, a]) => a.at === 'player' || a.over), final: def.final,
  };
}
/**
 * The rubric for a guardian, from its tuning (they run in their temples, not the Arena: the review plays them there).
 * Readability: its own moves' body tells (a combo's links are read off the move before); counterplay: moves, combos
 * and the ways it opens; space: shapes, the floor it uses (waves to jump, lobs to step from, dives that follow you);
 * phases: how many and how much each changes.
 */
export function scoreGuardian(G) {
  const readability = Math.max(1, band(G.teleMin, [0.8, 1.0, 1.2, 1.35]) - (G.floor ? 1 : 0) - (G.linkMin && G.linkMin < 0.6 ? 1 : 0));
  const counterplay = clamp5(1 + Math.min(6, G.attacks.length) * 0.35 + G.combos * 0.4 + (G.openMin ? 0.7 : 0) + (G.misses ? 0.7 : 0) + (G.kind === 'organic' ? 0.3 : 0));
  const space = clamp5(1 + G.shapes.length * 0.6 + (G.tracks ? 0.6 : 0) + (G.waves ? 0.6 : 0) + (G.lobs ? 0.6 : 0));
  const fairness = clamp5(G.teleMin >= 1.2 && (!G.linkMin || G.linkMin >= 0.6) ? 4.5 : G.teleMin >= 1 ? 3.5 : 2.5);
  const phases = clamp5(1 + G.phases * 0.9 + (G.newMoves.length && G.newMoves.every((n) => n > 0) ? 1 : 0));
  const total = +((readability + counterplay + space + fairness + phases) / 5).toFixed(1);
  return { readability, counterplay, space, fairness, phases, total,
    why: `body tells ${G.teleMin.toFixed(1)}-${G.teleMax.toFixed(1)} s (links ${G.linkMin ? G.linkMin.toFixed(2) : '-'} s), ${G.attacks.length} moves + ${G.moves - G.attacks.length} links, ${G.combos} combos (up to ${G.comboLen}), open ${G.openMin || '-'} s, ${G.misses} punish a miss, ${G.lobs} lobs, ${G.waves} waves, ${G.phases} phases (new moves ${G.newMoves.join('/') || '-'}), ${G.kind === 'organic' ? 'calmed' : 'broken'}` };
}

/**
 * A guardian's pace (v1.63, #258: a longer tell must not make its fight drag): each phase's round, the s to go once
 * through its moves in turn (each move's combo: every wind-up, the gaps between links, the last one's recover and
 * the opening after it) with the phase's pause between, and the whole fight's: one round of every phase. A measure
 * of how long a fight's beats are, not of a played fight (how many openings each phase wants is the temple's).
 */
export function guardianRound(def) {
  const A = def.attacks ?? {}, wind = (a) => a.wind ?? a.telegraph ?? 1.2;
  const phases = (def.phases ?? []).filter((p) => !p.weary).map((p) => +(p.attacks ?? []).reduce((s, id) => {
    let t = 0, a = A[id], n = 0, end = a;
    while (a && n++ < 6) { t += wind(a) + (a.then ? a.gap ?? 0.25 : a.recover ?? 0.8); end = a; a = a.then ? A[a.then] : null; }
    return s + t + (end?.open ?? 0) + (p.pause ?? 1.6);
  }, 0).toFixed(1));
  return { phases, total: +phases.reduce((a, b) => a + b, 0).toFixed(1) };
}

/** A markdown table (rows of cells). */
export function table(head, rows) {
  const line = (r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '/')).join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/** A median (the observed wind-ups). */
export const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// ---------------------------------------------------------------- the difficulty curve (arena.mjs --packs)

/**
 * The hearts a traveller can have arriving in each world of the route: the start, and every heart container of the shops
 * in the worlds before it bought (src/shop.js SHOPS: { world, wares: [{ id: 'heart', stock }] }); `own`: with its own
 * shop's too. An upper bound: what a careful player who buys every container has. A shop in a merged world's part
 * counts in its world (`merged`: src/levels/names.js MERGED; issue #560: the Almonry's in Vael, the Welcome-Shelf's in Lorn).
 */
export function heartsOnArrival(SHOPS, order, start = 3, merged = MERGED) {
  const per = {};
  for (const s of Object.values(SHOPS)) { const w = merged[s.world] ?? s.world; per[w] = (per[w] ?? 0) + (s.wares.find((x) => x.id === 'heart')?.stock ?? 0); }
  const out = {}; let h = start;
  for (const w of order) { out[w] = { arrival: h, own: h + (per[w] ?? 0) }; h += per[w] ?? 0; }
  return out;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
/**
 * The curve by world: the packs' means (size, hearts a minute, attacks a minute, time to kill), the threat in bars of the
 * hearts on arrival, and the **cost**: the hearts a pack takes from a traveller who trades blows with it standing still
 * (its hearts a minute × the time to kill all of it with each one's best move), as a share of the hearts on arrival.
 * A row's own stage and budget (what the page ran: --packs records them) win over the tables given.
 */
export function curveTable(rows, { hearts = {}, WORLDS = {}, BUDGET = [], order = [], startHearts = 3 } = {}) {
  return order.map((w) => {
    const R = rows.filter((r) => r.world === w), stage = R[0]?.stage ?? WORLDS[w]?.stage ?? null, H = hearts[w]?.arrival ?? startHearts;
    const hpm = mean(R.map((r) => r.heartsPerMin)), cost = mean(R.map((r) => (r.heartsPerMin * r.ttkBest) / 60));
    return {
      world: w, stage, budget: R[0]?.budget ?? (stage === null ? null : WORLDS[w]?.budget ?? BUDGET[Math.min(BUDGET.length - 1, stage)]), strikers: R[0]?.strikers ?? null, lead: WORLDS[w]?.lead ?? null,
      size: +mean(R.map((r) => r.pack.length)).toFixed(1), heartsPerMin: +hpm.toFixed(2), attacksPerMin: +mean(R.map((r) => r.attacksPerMin)).toFixed(1),
      ttkBest: +mean(R.map((r) => r.ttkBest)).toFixed(1), ttkCombo: +mean(R.map((r) => r.ttkCombo ?? Infinity)).toFixed(1),   // (∞: a member the combo alone never kills, a crab from the front; JSON keeps it as null)
      hearts: H, barsPerMin: +(hpm / H).toFixed(2), cost: +cost.toFixed(2), share: Math.round((cost / H) * 100), packs: R.map((r) => r.pack),
      // (arena.mjs --pack-clear: a scripted traveller clearing each pack, the s and the hearts it took, as a share of those on arrival)
      ...(R.some((r) => r.clear && !r.clear.error) ? (() => { const C = R.map((r) => r.clear).filter((c) => c && !c.error);
        const hearts = mean(C.map((c) => c.hearts));
        return { clearS: +mean(C.map((c) => c.s)).toFixed(1), clearHearts: +hearts.toFixed(2), clearShare: Math.round((hearts / H) * 100), cleared: C.filter((c) => c.cleared).length, clearRuns: C.length }; })() : {}),
      look: R[0]?.look ?? 'still',
    };
  });
}
/** The curve as a Markdown table (world by world, the route's order). */
export function curveMarkdown(curve) {
  const say = (p) => Object.entries(p.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {})).map(([k, n]) => (n > 1 ? `${n} ${k}` : k)).join(' + ');
  const n = (x) => (Number.isFinite(x) ? x : '∞');
  const look = curve[0]?.look === 'lock' ? 'locked on' : 'still', clear = curve.some((c) => c.clearS !== undefined);
  return table(['world', 'stage', 'budget', 'strikers', 'lead', 'pack size', `hearts/min (${look})`, 'attacks/min', 'ttk best (s)', 'ttk combo (s)', 'hearts on arrival', 'bars/min', 'cost (hearts)', 'cost share',
    ...(clear ? ['cleared in (s)', 'hearts to clear', 'clear share', 'cleared'] : []), 'packs watched'],
    curve.map((c) => [c.world, c.stage, c.budget ? c.budget.join('–') : '-', c.strikers ?? '-', c.lead ?? '-', c.size, c.heartsPerMin, c.attacksPerMin, n(c.ttkBest), n(c.ttkCombo), c.hearts, c.barsPerMin, c.cost, `${c.share} %`,
      ...(clear ? (c.clearS === undefined ? ['-', '-', '-', '-'] : [c.clearS, c.clearHearts, `${c.clearShare} %`, `${c.cleared} of ${c.clearRuns}`]) : []), c.packs.map(say).join('; ')]));
}

// ---------------------------------------------------------------- guard, parry and evade (defend.mjs)

/**
 * What a kind's tries against one attack say (defend.mjs: each { action: 'guard' | 'evade', lead (s before the blow), outcome:
 * 'parry' | 'block' | 'evaded' | 'hit' | 'missed' }): the furthest lead the guard still held (a block or a parry), the leads
 * that parried and those an evade swallowed it at (each as [nearest, furthest]), and how many got through.
 */
export function defenceWindows(tries = []) {
  const leads = (f) => tries.filter(f).map((t) => t.lead);
  const span = (xs) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  const held = leads((t) => t.action === 'guard' && (t.outcome === 'block' || t.outcome === 'parry'));
  return {
    guardHolds: held.length ? Math.max(...held) : null,
    parry: span(leads((t) => t.action === 'guard' && t.outcome === 'parry')),
    evade: span(leads((t) => t.action === 'evade' && t.outcome === 'evaded')),
    through: tries.filter((t) => t.outcome === 'hit').length,
    missed: tries.filter((t) => t.outcome === 'missed').length,
  };
}

const OUTCOME = { parry: 'P', block: 'B', evaded: 'E', hit: 'H', missed: '·' };
/**
 * The guard / parry / evade table (defend.mjs), grouped: by the kind's role (`group: 'role'`, kindFacts) or by the first
 * world that fields it (`'world'`), a heading and a table each, so a large roster reads in parts. Each row a kind's attack:
 * its wind-up, what a parry does to it, one cell a lead (P a parry, B a block, E evaded, H it got through, · it missed
 * anyway, blank not tried), the windows found.
 */
export function defenceMarkdown(rows, { leads = { guard: [], evade: [] }, group = 'role' } = {}) {
  const keyOf = (r) => (group === 'world' ? r.worlds?.[0] ?? 'the Arena only' : r.role ?? '-');
  const groups = [...new Set(rows.map(keyOf))];
  const win = (w) => (w ? (w[0] === w[1] ? `${w[0]}` : `${w[0]}–${w[1]}`) : '-');
  const head = ['kind', 'attack', 'wind (s)', 'on parry', ...leads.guard.map((l) => `guard ${l}`), ...leads.evade.map((l) => `evade ${l}`), 'guard holds from (s)', 'parry at (s)', 'evade at (s)', 'through'];
  const cell = (r, action, lead) => { const t = r.tries.find((x) => x.action === action && x.lead === lead); return t ? OUTCOME[t.outcome] ?? '?' : ''; };
  const out = ['Each cell: the try at that lead (s before the blow lands). P a perfect parry, B a block, E the evade swallowed it, H it got through, · nothing touched him (an early evade carried him out of its reach, or it struck elsewhere); blank: not tried (the attack came too seldom in the time given).', ''];
  for (const g of groups) {
    out.push(`### ${group === 'world' ? 'First fielded in' : 'Role'}: ${g}`, '');
    out.push(table(head, rows.filter((r) => keyOf(r) === g).map((r) => [r.name, r.atk, r.wind ?? '-', r.onParry ?? '-',
      ...leads.guard.map((l) => cell(r, 'guard', l)), ...leads.evade.map((l) => cell(r, 'evade', l)), r.guardHolds ?? '-', win(r.parry), win(r.evade), r.through])), '');
  }
  return out.join('\n');
}

/** Rows grouped for a report (arena.mjs --group): by role (kindFacts) or by the first world that fields them; { key: rows }. */
export function groupRows(rows, group, keyOf = (r) => (group === 'world' ? r.worldList?.[0] ?? 'the Arena only' : r.facts?.role ?? '-')) {
  const out = {};
  for (const r of rows) (out[keyOf(r)] ??= []).push(r);
  return out;
}
