// The sound QC (.claude/skills/sound-qc/SKILL.md): every player action and game event that should be heard
// (scripts/sound-qc/actions.mjs), each
//   1. looked for in the code: does the browser's game ask for it, and the engines' (engine/game.js: what Unity plays)?
//   2. rendered alone on the in-memory Web Audio (engine/webaudio.js), calm, its score off, six times: its loudest 50 ms
//      against the music's, its peak, onset and length, how much the takes differ; twice over: with the recorded takes
//      (public/sfx/, as the browser plays them) and without (the synth alone, as the engines play it);
//   3. driven in the engines' build of the whole game (scripts/sound-qc/drive.mjs, scenarios.mjs): which sounds the game
//      asked for after the press, and how soon;
// then the mix: the music's level in three worlds (the recording that plays, Music: Always, and the procedural score), a voice over it, the music under a conversation (ducking), the
// loudest moment of a fight. Everything muted: nothing is played out loud, it is all rendered to numbers.
//
//   node .claude/skills/sound-qc/run.mjs <out-dir> [--only hit,swing-1] [--no-drive] [--fresh] [--no-samples] [--score-ref]
//
// Writes <out>/sound-qc.json and sound-qc.md (the table). Exits 1 while a key action is not OK.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), has = (n) => args.includes(`--${n}`), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'sound-qc'));
mkdirSync(OUT, { recursive: true });
const L = await import(join(ROOT, 'scripts/sound-qc/lib.mjs'));
const { ACTIONS, loadKit } = await import(join(ROOT, 'scripts/sound-qc/actions.mjs'));
const { SCENARIOS } = await import(join(ROOT, 'scripts/sound-qc/scenarios.mjs'));
const { renderer } = await import(join(ROOT, 'scripts/sound-qc/render.mjs'));
await loadKit();   // (the gadgets' own sounds: src/gadgets/)
const only = arg('only')?.split(',');
const list = ACTIONS.filter((a) => !only || only.includes(a.id) || only.includes(a.group));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s]`, ...a);

// ---------------------------------------------------------------- 1. the code: who asks for it
const src = new Map(), read = (f) => { if (!src.has(f)) { try { src.set(f, readFileSync(join(ROOT, f), 'utf8')); } catch { src.set(f, ''); } } return src.get(f); };
const wiredIn = (pairs) => pairs.length > 0 && pairs.every(([f, re]) => re.test(read(f)));
for (const a of list) {
  a.wiredWeb = wiredIn(a.web);
  a.wiredEngine = a.engine === 'shared' ? a.wiredWeb : Array.isArray(a.engine) ? wiredIn(a.engine) : false;
}

// ---------------------------------------------------------------- 2. each sound alone, six takes, both ways
const pct = (v, p) => { const b = [...v].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
const p95 = (m) => +pct(L.envelope(L.kWeight(m.pcm), m.rate).map(L.dB), 0.95).toFixed(1);
// the reference: what plays in the desert (Music: Always, issue #474): its Suno recording once round the loop, at the gain
// the engines give it (src/theme-levels.js), its loud level (the 95th percentile of its 50 ms windows); the procedural
// score only where the recording can't be decoded (no afconvert), or asked for (--score-ref). The score's level is kept
// beside it: it is what a Moment plays in a world with no recording.
let REF;
{
  const R = await renderer({ samples: false, cache: join(tmpdir(), 'hiraeth-sound-qc-takes') });
  const rec = has('score-ref') ? null : await R.score('desert', { recording: true });
  const sc = await R.score('desert', { secs: 20 });
  REF = rec?.recorded ? { level: p95(rec), from: 'recording', file: rec.file, gain: rec.gain, score: p95(sc) } : { level: p95(sc), from: 'score', score: p95(sc) };
  R.close();
}
async function catalogue(samples) {
  const R = await renderer({ samples, cache: join(tmpdir(), 'hiraeth-sound-qc-takes') });
  const ref = REF.level;
  const out = {};
  for (const a of list) {
    const takes = [];
    for (let k = 0; k < L.LIMITS.repeats; k++) {
      const r = await R.render((s) => a.play(s), { seed: 1000 + k * 37, secs: a.role === 'cue' ? 4.5 : 2 });
      takes.push(L.measure(r.pcm, r.rate, { bed: r.bed }));
    }
    out[a.id] = { m: takes[0], v: L.variation(takes), takes };
  }
  R.close();
  return { ref, out, samples: R.samples };
}
log('rendering every sound: with the recorded takes (the browser)');
const web = await catalogue(!has('no-samples'));
log(`  the music's reference ${web.ref} dBFS (${REF.from === 'recording' ? `the desert's recording, ${REF.file} at ${REF.gain}` : 'the desert\'s procedural score: no recording decoded'}; the score ${REF.score})${web.samples ? '' : ' (no afconvert: the synth alone)'}; without them (the engines)`);
const eng = await catalogue(false);

// ---------------------------------------------------------------- 3. driven in the engines' build
const driven = {};
if (!has('no-drive')) {
  const { driver, engineBundle, FPS } = await import(join(ROOT, 'scripts/sound-qc/drive.mjs'));
  const file = await engineBundle(join(OUT, 'engine-game.js'), { fresh: has('fresh') || !has('keep-bundle') });
  const D = await driver({ file });
  const want = new Set(list.map((a) => a.drive).filter(Boolean));
  for (const id of want) {
    log(`driving ${id}`);
    try {
      const r = await D.play(SCENARIOS[id]);
      driven[id] = { calls: r.calls, fps: FPS };
    } catch (e) { driven[id] = { error: String(e?.message ?? e).slice(0, 200) }; }
  }
}

// ---------------------------------------------------------------- the verdicts
const rows = [];
for (const a of list) {
  const w = web.out[a.id], e = eng.out[a.id], d = a.drive ? driven[a.drive] : null;
  let press = null, heardInGame = null;
  if (d?.calls) {
    // (a call named 'name' or 'name:arg', its first argument: 'potion:heal')
    const counts = (x) => (a.calls ?? []).some((c) => { const [n, arg] = c.split(':'); return n === x.name && (arg == null || String(x.args[0]) === arg); });
    const c = d.calls.find((x) => counts(x) && x.f >= 0 && (x.name !== 'fluidSlashHit' || x.args[0] === true));
    heardInGame = !!c;
    if (c) press = c.f / d.fps + (e.m?.onset ?? 0);
  }
  const vw = L.judge(w.m, a.role, web.ref, { v: w.v, wired: a.wiredWeb, repeats: a.repeats });
  const ve = L.judge(e.m, a.role, eng.ref, { v: e.v, press: a.press ? press : null, wired: a.wiredEngine && heardInGame !== false, repeats: a.repeats });
  if (heardInGame === false && a.wiredEngine) ve.why.unshift('missing: the engines\' game never asked for it in its scenario');
  // (the same judged against the procedural score, the reference before issue #499: what is the music's level, what the sound's own)
  const sw = L.judge(w.m, a.role, REF.score, { v: w.v, wired: a.wiredWeb, repeats: a.repeats });
  const se = L.judge(e.m, a.role, REF.score, { v: e.v, press: a.press ? press : null, wired: a.wiredEngine && heardInGame !== false, repeats: a.repeats });
  if (heardInGame === false && a.wiredEngine) se.verdict = 'missing';
  rows.push({ id: a.id, what: a.what, group: a.group, role: a.role, key: a.key, web: { ...vw, m: w.m, v: w.v, rel: w.m ? +(w.m.rms - web.ref).toFixed(1) : null },
    vsScore: { web: sw.verdict, engine: se.verdict, why: [...sw.why.map((x) => `web ${x}`), ...se.why.map((x) => `eng ${x}`)] },
    engine: { ...ve, m: e.m, v: e.v, rel: e.m ? +(e.m.rms - eng.ref).toFixed(1) : null, press: press == null ? null : +press.toFixed(3), driven: heardInGame } });
}
// sounds that should differ: a hit from a block, a confirm from a back, a quest's start, step and end
// and the glove's modes from each other (the mode you switched to, heard)
const GLOVE = ['glove-fluid', 'glove-push', 'glove-stilling', 'gun-mode', 'glove-bloom', 'glove-tether'];
const ALIKE = [['hit', 'block'], ['menu-confirm', 'menu-back'], ['quest-start', 'quest-step'], ['quest-step', 'quest-done'], ['quest-start', 'quest-done'], ['swing-1', 'swing-3'],
  ...GLOVE.flatMap((x, i) => GLOVE.slice(i + 1).map((y) => [x, y]))];
for (const [x, y] of ALIKE) {
  const X = rows.find((r) => r.id === x), Y = rows.find((r) => r.id === y);
  for (const way of ['web', 'engine']) {
    const a = X?.[way].m, b = Y?.[way].m;
    if (!a || !b) continue;
    const same = Math.abs(a.centroid - b.centroid) / Math.max(a.centroid, b.centroid) < 0.05 && Math.abs(a.dur - b.dur) < 0.05 && Math.abs(a.rms - b.rms) < 1.5;
    if (same) for (const R of [X, Y]) { R[way].why.push(`alike: sounds as ${R === X ? y : x}`); if (R[way].verdict === 'OK') R[way].verdict = 'alike'; if (R.vsScore[way] === 'OK') R.vsScore[way] = 'alike'; }
  }
}

// ---------------------------------------------------------------- the mix
log('the mix');
const R = await renderer({ samples: web.samples, cache: join(tmpdir(), 'hiraeth-sound-qc-takes') });
const mix = { music: {} }, rec = REF.from === 'recording';
for (const lv of ['desert', 'bazaar', 'home']) {
  for (const way of rec ? ['recording', 'score'] : ['score']) {
    const m = await R.score(lv, way === 'recording' ? { recording: true } : { secs: 16 });
    if (way === 'recording' && !m.recorded) continue;
    const lvls = L.envelope(L.kWeight(m.pcm), m.rate).map(L.dB);
    mix.music[`${lv} ${way}`] = { p50: +pct(lvls, 0.5).toFixed(1), p95: +pct(lvls, 0.95).toFixed(1), max: +Math.max(...lvls).toFixed(1), file: m.file ?? null };
  }
}
{
  const { planLine, voiceOf } = await import(join(ROOT, 'src/story/voice.js'));
  const plan = planLine('~neutral~ We heard the tower speak tonight, all of us, over the market.', { voice: voiceOf({ id: 'qc', voice: 1 }), lang: 'desert' });
  // the voice alone (no score), and the music bus's gain while a conversation's line plays against before it
  const v = await R.render((s) => s.speak(plan, { channel: 'dialogue' }), { secs: plan.total + 0.5 });
  mix.voice = L.measure(v.pcm, v.rate, { bed: v.bed });
  let before = null, during = null;
  await R.score('desert', { secs: 4, recording: rec, at: 30, during: (s, t) => { if (Math.abs(t - 1) < 1e-6) { before = s.music.gain.value; s.speak(plan, { channel: 'dialogue' }); } if (Math.abs(t - 2.5) < 1e-6) during = s.music.gain.value; } });
  mix.duck = { before: +before.toFixed(3), during: +during.toFixed(3), dB: +L.dB(during / before).toFixed(1) };
  // a fight's loudest moment: the heavy third landing on a foe as a blow lands on him
  const f = await R.render((s) => { s.fluidSlash(2); s.fluidSlashHit(true, true); s.foeHurt('blot'); s.hurt(1, 'foe'); }, { secs: 1.5 });
  mix.fight = L.measure(f.pcm, f.rate, { bed: f.bed });
}
R.close();
const ref = web.ref;
mix.voiceRel = mix.voice ? +(mix.voice.rms - ref).toFixed(1) : null;
mix.fightRel = mix.fight ? +(mix.fight.rms - ref).toFixed(1) : null;
mix.notes = [
  mix.voiceRel != null && mix.voiceRel < -3 ? `a voice sits ${mix.voiceRel} dB under the music: lost under it` : null,
  mix.duck.dB > -2 ? `the music does not step back under a conversation (${mix.duck.dB} dB): duck it 3-6 dB` : null,
  mix.fight?.peak > L.LIMITS.truePeak ? `the fight's loudest moment peaks at ${mix.fight.peak} dBFS` : null,
  mix.fightRel > 8 ? `the fight's loudest moment is ${mix.fightRel} dB over the music` : null,
].filter(Boolean);

// ---------------------------------------------------------------- the report
const bad = rows.filter((r) => r.key && (r.web.verdict !== 'OK' || r.engine.verdict !== 'OK'));
const json = { at: new Date().toISOString(), ref: { web: web.ref, engine: eng.ref, from: REF.from, file: REF.file ?? null, gain: REF.gain ?? null, score: REF.score }, samples: web.samples, limits: L.LIMITS, roles: L.ROLES, rows, mix, driven: Object.fromEntries(Object.entries(driven).map(([k, d]) => [k, d.error ? d : { calls: d.calls.slice(0, 40) }])) };
writeFileSync(join(OUT, 'sound-qc.json'), JSON.stringify(json, null, 1));
const cell = (v) => (v.verdict === 'OK' ? 'OK' : `**${v.verdict}**`);
const lv = (v) => (v.m ? `${v.rel > 0 ? '+' : ''}${v.rel}` : '–');
const vari = (v) => (v.v ? `${v.v.level} dB / ${v.v.centroid} %` : '–');
const refWhat = REF.from === 'recording' ? `the desert's recording, ${REF.file} at the engines' gain ${REF.gain} (src/theme-levels.js), once round its loop` : 'the desert\'s procedural score: **no recording decoded**';
let md = `# Sound QC\n\n${json.at} · the music's reference (${refWhat}; the 95th percentile of its 50 ms windows): ${web.ref} dBFS · the procedural score (a Moment where no recording plays): ${REF.score} dBFS` +
  `${web.samples ? '' : ' · **no recorded takes decoded** (afconvert missing): the web column is the synth'}\n\n` +
  `Levels: the sound's loudest 50 ms against that, dB. Web: the browser (the recorded takes and the synth); engines: engine/game.js on the in-memory Web Audio (the synth alone, what Unity plays). ` +
  `press: from the key to the first sound in the engines' game. var: the spread of six takes (level / brightness).\n\n` +
  `| action | role | web | engines | level web / eng | dur s | var web | var eng | press ms | why |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for (const g of [...new Set(rows.map((r) => r.group))]) {
  md += `| **${g}** | | | | | | | | | |\n`;
  for (const r of rows.filter((x) => x.group === g)) {
    md += `| ${r.key ? '★ ' : ''}${r.what} (\`${r.id}\`) | ${r.role} | ${cell(r.web)} | ${cell(r.engine)} | ${lv(r.web)} / ${lv(r.engine)} | ${r.web.m?.dur ?? '–'} | ${vari(r.web)} | ${vari(r.engine)} | ${r.engine.press == null ? '' : Math.round(r.engine.press * 1000)} | ${[...new Set([...r.web.why.map((x) => `web ${x}`), ...r.engine.why.map((x) => `eng ${x}`)])].join('; ')} |\n`;
  }
}
const count = (k) => rows.filter((r) => r[k].verdict === 'OK').length, countScore = (k) => rows.filter((r) => r.vsScore[k] === 'OK').length;
const offScore = rows.filter((r) => r.vsScore.web !== 'OK' || r.vsScore.engine !== 'OK');
md += `\n★ a key action. OK: web ${count('web')} / ${rows.length}, engines ${count('engine')} / ${rows.length}; key actions not OK: ${bad.length ? bad.map((r) => r.id).join(', ') : 'none'}.\n\n` +
  (REF.from === 'recording' ? `Against the procedural score instead (${REF.score} dBFS, the reference before issue #499: the music's level ${+(REF.score - web.ref).toFixed(1)} dB away; what is the sound's own): OK web ${countScore('web')} / ${rows.length}, engines ${countScore('engine')} / ${rows.length}; not OK: ${offScore.length ? offScore.map((r) => `${r.id} (${r.vsScore.web === r.vsScore.engine ? r.vsScore.web : `${r.vsScore.web} / ${r.vsScore.engine}`})`).join(', ') : 'none'}.\n\n` : '') +
  `## The mix\n\n` +
  `| | p50 | p95 | max |\n|---|---|---|---|\n${Object.entries(mix.music).map(([k, m]) => `| the ${k.split(' ')[0]}'s ${k.split(' ')[1]}${m.file ? ` (${m.file})` : ''} | ${m.p50} | ${m.p95} | ${m.max} |`).join('\n')}\n\n` +
  `- a conversation's voice alone: ${mix.voice?.rms} dBFS (${mix.voiceRel} dB against the music)\n- the music under a conversation: ${mix.duck.dB} dB (its bus ${mix.duck.before} → ${mix.duck.during})\n` +
  `- a fight's loudest moment (the heavy third landing as a blow lands on him): ${mix.fight?.rms} dBFS, peak ${mix.fight?.peak} (${mix.fightRel} dB against the music)\n` +
  (mix.notes.length ? `\n${mix.notes.map((n) => `- **${n}**`).join('\n')}\n` : '\n- nothing out of place\n');
writeFileSync(join(OUT, 'sound-qc.md'), md);
log(`written ${join(OUT, 'sound-qc.md')}`);
if (REF.from === 'recording') console.log(`against the procedural score: OK web ${countScore('web')}/${rows.length}, engines ${countScore('engine')}/${rows.length}; not OK: ${offScore.map((r) => r.id).join(', ') || 'none'}`);
console.log(`\nOK web ${count('web')}/${rows.length}, engines ${count('engine')}/${rows.length}; key actions not OK: ${bad.length ? bad.map((r) => `${r.id} (${r.web.verdict} / ${r.engine.verdict})`).join(', ') : 'none'}`);
for (const n of mix.notes) console.log(`mix: ${n}`);
process.exit(bad.length ? 1 : 0);
