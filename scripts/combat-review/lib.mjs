// The combat review's pure part (.claude/skills/combat-review/SKILL.md; the Arena-driving script is
// .claude/skills/combat-review/arena.mjs; tests/combat-review.test.js). It reads whatever foe kinds and guardians the
// game has (the roster is growing: nothing here names a kind), turns the blade's and the gun's tuning into moves with a
// damage and a cycle time, and scores each foe on the rubric from its tuning and from what the Arena run measured.
// Every automatic score is a starting point the reviewer confirms or overrides by eye (the contact sheet, playing).

/** The player's moves, from the tuning the game exports (src/fluid-blade.js, src/fluid-tool.js FLUID, src/fluid-kit.js MODES). */
export function movesFrom({ BLADE, SWINGS, CHARGE, AIR, RIPOSTE, DASH, FLUID, MODES }) {
  const span = (S) => (S.to ?? 0) - (S.from ?? 0);
  const combo = SWINGS.map(span), comboTime = combo.reduce((a, b) => a + b, 0) + BLADE.cooldown;
  const comboDamage = BLADE.damage.reduce((a, b) => a + b, 0);
  // the gun: `charges` shots a tank, each mode's cost (rate) out of it, `cooldown` s apart, then the refill's delay
  const gun = (mode) => {
    const per = Math.max(1, Math.floor(FLUID.charges / Math.max(0.05, MODES[mode]?.rate ?? 1)));
    const cycle = per * (FLUID.shoot?.cooldown ?? 0.3) + FLUID.refillDelay;
    return { cycle: cycle / per, burst: per };
  };
  return [
    { id: 'combo', label: 'light combo (3 swings)', mode: 'blade', damage: comboDamage / combo.length, hits: BLADE.damage.slice(), cycle: comboTime / combo.length, source: 'combo' },
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
export const timeToKill = (r, move, attackCycle = 0) => (r.dead ? +(r.hits * move.cycle + (move.gated ? r.hits * attackCycle : 0)).toFixed(2) : null);

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
    if (a.at === 'target') space.push('lob');
    if (a.lunge) space.push('lunge');
    for (const k of ['grab', 'tether', 'blind', 'leave', 'blink', 'surface', 'sweep', 'leap', 'encircle', 'reverse']) if (a[k]) space.push(k);
  }
  return {
    kind, name: D.name, hp: D.hp, speed: D.speed,
    attacks: attacks.map((a) => a.id ?? 'strike'),
    windMin: winds.length ? Math.min(...winds) : 0, windMax: winds.length ? Math.max(...winds) : 0,
    damageMax: Math.max(0, ...attacks.map((a) => Math.max(a.damage ?? 0, a.wave?.damage ?? 0))),
    ways: [...new Set(ways)], space: [...new Set(space)],
    tone: !!D.tone, sound: !!D.sound, role: D.keep || attacks.some((a) => a.at === 'target') ? 'ranged' : D.hover ? 'air' : D.heavy || D.hp >= 4 ? 'heavy' : D.light || D.group ? 'swarm' : 'melee',
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

/** A markdown table (rows of cells). */
export function table(head, rows) {
  const line = (r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '/')).join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/** A median (the observed wind-ups). */
export const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
