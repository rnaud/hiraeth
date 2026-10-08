// The dialogue review's corpus (.claude/skills/dialogue-review/SKILL.md): every conversation tree, listen-only
// talk and spoken list in the story data (src/story/*-data.js) and the levels' own people (src/levels/content.js),
// written out world by world as a script a person can read (speaker, node, pages with their tones, the answers and
// where they lead), with each line measured and flagged against the voice guide (lore/voice-guide.md) and the
// review's checks. Nothing runs the game; it only imports the data, as tests/tone.test.js does.
//
//   node .claude/skills/dialogue-review/extract.mjs <out-dir> [--worlds desert,incal]
// Writes <out-dir>/<world>.md (the script), <out-dir>/metrics.json and prints a summary.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(process.argv[2] ?? 'dialogue-review');
const only = (() => { const i = process.argv.indexOf('--worlds'); return i > 0 ? new Set(process.argv[i + 1].split(',')) : null; })();
const { parseLine } = await import(pathToFileURL(join(ROOT, 'src/story/tone.js')));
mkdirSync(OUT, { recursive: true });

// ---- the checks (thresholds from the voice guide and the review's research; tune them in SKILL.md, not here only)
const PAGE_MAX = 45, PAGE_HINT_MAX = 25, SENTENCE_MAX = 25, CHOICE_MAX = 60;
const KEY_WORDS = /\b(LT|RT|LB|RB|L3|R3|D-pad|A \/ ×|B \/ ○|X \/ □|Y \/ △|Ctrl|Alt|Shift|Tab|Space(bar)?|left click|right click|press [A-Z]\b|[A-Z] key)\b/;
const SLANG = /\b(okay|ok|cool|guys|literally|vibes?|awesome|dude|lol|gonna|wanna|super (?:weird|cool)|no worries|my bad|totally)\b/i;
const THERAPY = /\b(process(?:ing)? (?:your|my|the) (?:grief|feelings)|healing journey|valid(?:ate|ated)?|boundar(?:y|ies)|trauma(?:tic)?|closure|toxic|safe space|self-care|unpack (?:that|this))\b/i;
const GOODBYE = /^(bye|goodbye|farewell|see you|later|thanks?,? bye|i should go|i'll go|never mind|nothing|leave)\b/i;
const GREETING = /^(hello|hi|greetings|welcome|well met|good (?:morning|day|evening))\b[^.!?]*(?:traveller|stranger|friend|sky-stranger)?/i;
const AS_YOU_KNOW = /\bas you know\b|\byou (?:already )?know (?:that|how)\b|\bremember when we\b/i;

const words = (s) => (String(s).match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;
const sentences = (s) => String(s).replace(/\([^)]*\)/g, '').split(/(?<=[.!?…])\s+/).filter((x) => words(x));
function flagsOf(text, kind) {
  const f = [], w = words(text);
  if (kind === 'page' && w > PAGE_MAX) f.push(`long page (${w} words)`);
  if (kind === 'hint' && w > PAGE_HINT_MAX) f.push(`long hint (${w} words)`);
  if (kind === 'choice' && w > 12) f.push(`long answer (${w} words)`);
  for (const s of sentences(text)) if (words(s) > SENTENCE_MAX) { f.push(`long sentence (${words(s)} words)`); break; }
  if (KEY_WORDS.test(text)) f.push('a button named in prose (follow remapping: a key placeholder)');
  if (SLANG.test(text)) f.push(`modern slang: “${text.match(SLANG)[0]}”`);
  if (THERAPY.test(text)) f.push(`therapy-speak: “${text.match(THERAPY)[0]}”`);
  if (AS_YOU_KNOW.test(text)) f.push('as-you-know exposition');
  if ((text.match(/!/g) ?? []).length > 2) f.push('many exclamation marks');
  return f;
}

// ---- walking the data (as tests/tone.test.js and tests/dialogue-choices.test.js do)
const SEEN = new Set();
function trees(v, where, out = []) {
  if (v == null || typeof v !== 'object' || SEEN.has(v)) return out;
  SEEN.add(v);
  const talk = v.talk ?? v;
  if (talk?.nodes && Object.values(talk.nodes).some((n) => n && ('say' in n || 'choices' in n))) { out.push({ where, name: v.name ?? null, kind: 'tree', talk }); return out; }
  if (Array.isArray(talk?.listen)) { out.push({ where, name: v.name ?? null, kind: 'listen', talk }); return out; }
  for (const [k, x] of Object.entries(v)) if (!['if', 'after', 'do', 'set', 'palette'].includes(k)) trees(x, `${where}.${k}`, out);
  return out;
}
const pages = (say) => [say].flat().filter((p) => p != null).map((p) => parseLine(typeof p === 'object' && !('tone' in p) ? (p.text ?? p.say ?? '') : p));
const worldOf = (file) => file.replace(/-data\.js$/, '').replace(/\.js$/, '');

const SRC = join(ROOT, 'src');
const sources = [];
for (const f of readdirSync(join(SRC, 'story')).filter((f) => f.endsWith('-data.js'))) {
  const m = await import(pathToFileURL(join(SRC, 'story', f)));
  for (const [k, v] of Object.entries(m)) if (!['QUESTS', 'ITEMS', 'KEEPSAKE', 'STAGE_MIGRATION', 'STAGE_MERGE'].includes(k)) sources.push({ world: worldOf(f), where: `src/story/${f}:${k}`, value: v });
}
// the temples' guides and guardians (src/temples/<world>-data.js) count as their world's
for (const f of readdirSync(join(SRC, 'temples')).filter((f) => f.endsWith('-data.js'))) {
  const m = await import(pathToFileURL(join(SRC, 'temples', f)));
  for (const [k, v] of Object.entries(m)) sources.push({ world: worldOf(f), where: `src/temples/${f}:${k}`, value: v });
}
// the recordings (src/story/calls.js): the parents' reel, not a tree; read as a speaker of their own
{
  const calls = await import(pathToFileURL(join(SRC, 'story/calls.js')));
  const said = [];
  const grab = (v) => { if (typeof v === 'string') said.push(v); else if (Array.isArray(v)) v.forEach(grab); else if (v && typeof v === 'object') Object.values(v).forEach(grab); };
  for (const k of ['PROLOGUE_CALL', 'ILEN_CALL', 'TRACE_CALL', 'ILEN_AFTER_CALL', 'REEL']) grab(calls[k]);
  sources.push({ world: 'recordings', where: 'src/story/calls.js', value: { reel: { name: 'the recordings', talk: { listen: said.filter((s) => /^\s*~[a-z]+~/.test(s)) } } } });
}
const { CONTENT } = await import(pathToFileURL(join(SRC, 'levels/content.js')));
for (const [id, c] of Object.entries(CONTENT)) sources.push({ world: id, where: `src/levels/content.js:${id}`, value: { npcs: c.npcs, traces: c.traces, things: c.things } });

const worlds = new Map();   // world → { speakers: [...], lines: [...] }
for (const s of sources) {
  if (only && !only.has(s.world)) continue;
  for (const t of trees(s.value, s.where)) {
    const w = worlds.get(s.world) ?? { speakers: [], lines: [] };
    worlds.set(s.world, w);
    const speaker = { where: t.where, name: t.name ?? t.where.split('.').slice(-2, -1)[0] ?? t.where, kind: t.kind, nodes: [] };
    w.speakers.push(speaker);
    const add = (text, tone, kind, at) => { const l = { world: s.world, speaker: speaker.name, at, text, tone, kind, words: words(text), flags: flagsOf(text, kind) }; w.lines.push(l); return l; };
    if (t.kind === 'listen') {
      t.talk.listen.forEach((e, i) => {
        const ps = pages(e && typeof e === 'object' && 'say' in e ? e.say : e);
        speaker.nodes.push({ id: `listen ${i + 1}`, pages: ps.map((p) => add(p.text, p.tone, 'hint', `listen[${i}]`)), choices: [] });
      });
      continue;
    }
    for (const [nid, n] of Object.entries(t.talk.nodes)) {
      if (!n) continue;
      const node = { id: nid, pages: pages(n.say).map((p, i) => add(p.text, p.tone, 'page', `${nid}.say[${i}]`)), choices: [] };
      for (const [i, c] of (n.choices ?? []).entries()) {
        const p = parseLine(c.text ?? '');
        const l = add(p.text, p.tone, 'choice', `${nid}.choices[${i}]`);
        l.goto = c.goto ?? (c.end ? '(ends)' : null); l.cond = !!c.if;
        if (GOODBYE.test(p.text) && c.end) l.flags.push('goodbye-only answer (B / Esc already closes)');
        node.choices.push(l);
      }
      const nf = [];
      if (node.choices.length > 3) nf.push(`${node.choices.length} answers (the house cap is 3)`);
      if (node.pages.length >= 4) nf.push(`monologue: ${node.pages.length} pages with no answer between`);
      if (nid === Object.keys(t.talk.nodes)[0] && node.pages[0] && GREETING.test(node.pages[0].text)) nf.push('opens on a greeting: start in the middle of what they are doing');
      if (nf.length) node.flag = nf.join('; ');
      speaker.nodes.push(node);
    }
  }
}

// ---- across lines: phrases repeated by different speakers, proper-noun load, speakers stuck in one tone
const all = [...worlds.values()].flatMap((w) => w.lines);
const grams = new Map();
for (const l of all) {
  const ws = String(l.text).toLowerCase().match(/[\p{L}’'-]+/gu) ?? [];
  for (let i = 0; i + 5 <= ws.length; i++) { const g = ws.slice(i, i + 5).join(' '); const e = grams.get(g) ?? new Set(); e.add(`${l.world}/${l.speaker}`); grams.set(g, e); }
}
// (overlapping windows of one phrase, said by the same speakers, are kept once: "the gun's push mode x" and
// "gun's push mode x or" are the same repetition)
const repeated = [];
for (const [g, who] of [...grams].filter(([, w]) => w.size >= 3).sort((a, b) => b[1].size - a[1].size)) {
  const key = [...who].sort().join('|'), ws = g.split(' ');
  if (repeated.some((r) => r.key === key && (r.phrase.includes(ws.slice(0, 3).join(' ')) || r.phrase.includes(ws.slice(-3).join(' '))))) continue;
  repeated.push({ key, phrase: g, speakers: [...who].slice(0, 8), count: who.size });
  if (repeated.length >= 60) break;
}
for (const r of repeated) delete r.key;
const nounsOf = (lines) => {
  const c = new Map();
  for (const l of lines) for (const m of String(l.text).matchAll(/(?<![.!?…]\s|^)\b([A-Z][\p{Ll}’'-]{2,}(?:\s[A-Z][\p{Ll}]+)?)/gu)) c.set(m[1], (c.get(m[1]) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]);
};
const metrics = { date: new Date().toISOString(), totals: {}, worlds: {}, repeated };
for (const [id, w] of worlds) {
  const spoken = w.lines.filter((l) => l.kind !== 'choice'), choices = w.lines.filter((l) => l.kind === 'choice');
  const tones = {}; for (const l of w.lines) tones[l.tone] = (tones[l.tone] ?? 0) + 1;
  const stuck = w.speakers.map((s) => { const t = {}; let n = 0; for (const nd of s.nodes) for (const l of [...nd.pages, ...nd.choices]) if (l.kind !== 'choice') { t[l.tone] = (t[l.tone] ?? 0) + 1; n++; }
    const [top, k] = Object.entries(t).sort((a, b) => b[1] - a[1])[0] ?? []; return n >= 6 && k / n > 0.8 ? `${s.name}: ${Math.round((100 * k) / n)}% ${top}` : null; }).filter(Boolean);
  metrics.worlds[id] = {
    speakers: w.speakers.length, pages: spoken.length, answers: choices.length,
    words: spoken.reduce((a, l) => a + l.words, 0), median_words_a_page: spoken.map((l) => l.words).sort((a, b) => a - b)[Math.floor(spoken.length / 2)] ?? 0,
    flagged: w.lines.filter((l) => l.flags.length).length + w.speakers.flatMap((s) => s.nodes).filter((n) => n.flag).length, tones, one_tone_speakers: stuck,
    // (Spiritfarer's balance, about 10–15% of the lines dramatic: a world over 30% sad or solemn, or with nothing light, is worth a look)
    tone_mix: (() => { const n = spoken.length || 1, sad = spoken.filter((l) => ['sad', 'solemn'].includes(l.tone)).length, light = spoken.filter((l) => ['playful', 'happy'].includes(l.tone)).length;
      return { sad_or_solemn: +(sad / n).toFixed(2), playful_or_happy: +(light / n).toFixed(2), flag: sad / n > 0.3 ? 'heavy: over 30% sad or solemn' : light === 0 && n > 10 ? 'nothing light' : null }; })(),
    node_flags: w.speakers.flatMap((s) => s.nodes.filter((n) => n.flag).map((n) => `${s.name} · ${n.id}: ${n.flag}`)),
    proper_nouns: nounsOf(spoken).slice(0, 25).map(([n, k]) => `${n} ×${k}`), distinct_proper_nouns: nounsOf(spoken).length,
  };
  // the readable script
  const md = [`# ${id}: the dialogue as written`, '', `${w.speakers.length} speakers, ${spoken.length} pages, ${choices.length} answers. Flags in ⚑ (see metrics.json).`, ''];
  for (const s of w.speakers) {
    md.push(`## ${s.name}`, `\`${s.where}\` · ${s.kind === 'listen' ? 'listen-only' : 'conversation'}`, '');
    for (const n of s.nodes) {
      md.push(`**${n.id}**${n.flag ? ` ⚑ ${n.flag}` : ''}`);
      for (const p of n.pages) md.push(`> *${p.tone}* ${p.text}${p.flags.length ? `  ⚑ ${p.flags.join('; ')}` : ''}`);
      for (const c of n.choices) md.push(`- ${c.cond ? '(if) ' : ''}“${c.text}” → ${c.goto ?? '·'}${c.flags.length ? `  ⚑ ${c.flags.join('; ')}` : ''}`);
      md.push('');
    }
  }
  writeFileSync(join(OUT, `${id}.md`), md.join('\n'));
}
const flagCount = {};
for (const w of worlds.values()) for (const s of w.speakers) for (const n of s.nodes) if (n.flag) for (const f of n.flag.split('; ')) { const k = f.replace(/:.*$/, '').replace(/\s*\(.*/, '').replace(/^\d+ answers/, 'over 3 answers'); flagCount[k] = (flagCount[k] ?? 0) + 1; }
for (const l of all) for (const f of l.flags) { const k = f.replace(/\s*\(.*|:.*$/g, '').replace(/“.*/, '').trim(); flagCount[k] = (flagCount[k] ?? 0) + 1; }
metrics.totals = { worlds: worlds.size, lines: all.length, pages: all.filter((l) => l.kind !== 'choice').length, answers: all.filter((l) => l.kind === 'choice').length, flags: flagCount };
writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
console.log(`${metrics.totals.lines} lines in ${worlds.size} worlds (${metrics.totals.pages} pages, ${metrics.totals.answers} answers) → ${OUT}`);
console.log('flags:', JSON.stringify(flagCount));
console.log('phrases said by 3+ speakers:', repeated.slice(0, 8).map((r) => `“${r.phrase}” ×${r.count}`).join(' · '));
for (const [id, m] of Object.entries(metrics.worlds)) console.log(`  ${id.padEnd(14)} ${String(m.speakers).padStart(3)} speakers ${String(m.pages).padStart(4)} pages, median ${m.median_words_a_page} words, ${m.flagged} flagged, ${m.distinct_proper_nouns} proper nouns${m.tone_mix.flag ? `, ${m.tone_mix.flag}` : ''}${m.one_tone_speakers.length ? `, one-tone: ${m.one_tone_speakers.slice(0, 3).join(', ')}` : ''}`);
