// The clarity pass (issue #626): every speaker of the extracted script (extract.mjs beside this file) scored 1-5 on how
// plainly it speaks: sentence length, long words, figures of speech, objects given wants, pages opening on a pronoun,
// fragments, help nodes (again, how, where…) with no imperative and no starred place. It points; an editor scores.
//   node .claude/skills/dialogue-review/clarity.mjs <extract-dir> <out.json>   (the discarded side worlds left out)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2], OUT = process.argv[3];
const SIDE = new Set(['mangrove', 'waterfall', 'saltharbour', 'antennas', 'eclipse', 'fallenring', 'underside']);
const words = (s) => (s.match(/[\p{L}\p{N}’'-]+/gu) ?? []);
const syl = (w) => Math.max(1, (w.toLowerCase().replace(/e\b/, '').match(/[aeiouy]+/g) ?? []).length);
const sentences = (s) => s.replace(/\([^)]*\)/g, '').split(/(?<=[.!?…])\s+/).filter((x) => words(x).length);
const IMP = /^(?:\*?)(go|walk|climb|take|push|roll|pull|shoot|splash|light|ring|follow|look|find|stand|wait|jump|swim|cross|fly|ride|turn|bring|give|put|cut|hit|throw|open|switch|watch|keep|try|use|head|step|hold|catch|play|blow|send|swing|carry|dig|press|whistle|listen|mind|hop|glide|fan|still|stomp|aim|drop|break|lift|lower|raise|call|enter|follow|search|check|knock|feed|drink|fill|leave|come|get|let|make|set|start|ask|tell|show|wake)\b/i;
const FIG = /\b(like a|like the|like an|as if|as though)\b/i;
const PERSON = /\b(it|that|this|the \w+) (wants|likes|knows|remembers|forgets|sulks|minds|considers|prefers|dreams|sleeps|hungers|longs|waits for|asks for|wishes)\b/i;
const VAGUE = /^(it|they|that|this|those|these|there|he|she)\b/i;
const HINTNODE = /^(again|hint|how|where|help|way|go|next|lost|stuck|route|path|door|back)/i;
const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && !SIDE.has(f.replace('.md', '')));
const rows = [];
for (const f of files) {
  const world = f.replace('.md', '');
  let sp = null, node = null, firstInNode = false;
  for (const line of readFileSync(join(DIR, f), 'utf8').split('\n')) {
    if (line.startsWith('## ')) { sp = { world, name: line.slice(3).trim(), where: '', pages: [] }; rows.push(sp); continue; }
    if (sp && line.startsWith('`src/')) { sp.where ||= line.split('`')[1]; continue; }
    const m = line.match(/^\*\*([^*]+)\*\*/); if (m) { node = m[1].trim(); firstInNode = true; continue; }
    if (sp && line.startsWith('> ')) {
      const t = line.slice(2).replace(/\s+⚑.*$/, '');
      const tone = (t.match(/^\*(\w+)\*/) ?? [])[1] ?? '';
      const text = t.replace(/^\*\w+\*\s*/, '');
      sp.pages.push({ node, text, first: firstInNode, tone }); firstInNode = false;
    }
  }
}
const out = [];
for (const sp of rows) {
  if (!sp.pages.length) continue;
  let S = 0, W = 0, longS = 0, longW = 0, fig = 0, pers = 0, vague = 0, frag = 0, hintPoetry = 0, imp = 0;
  const worst = [];
  for (const p of sp.pages) {
    const ss = sentences(p.text.replace(/\*([^*]+)\*/g, '$1'));
    let pen = 0;
    for (const s of ss) {
      const ws = words(s); S++; W += ws.length;
      if (ws.length > 18) { longS++; pen += 1; }
      for (const w of ws) if (syl(w) >= 4) { longW++; pen += 0.3; }
      if (IMP.test(s.trim())) imp++;
      if (ws.length <= 3 && !/[?!]$/.test(s.trim()) && !/^(mm|yes|no|good|right|ah|oh|hm)/i.test(s.trim())) { frag++; pen += 0.3; }
    }
    if (FIG.test(p.text)) { fig++; pen += 1; }
    if (PERSON.test(p.text)) { pers++; pen += 1; }
    if (p.first && VAGUE.test(p.text.replace(/^\([^)]*\)\s*/, ''))) { vague++; pen += 1; }
    if (p.node && HINTNODE.test(p.node) && !ss.some((s) => IMP.test(s.trim())) && !/\*[^*]+\*/.test(p.text)) { hintPoetry++; pen += 1.5; }
    worst.push({ pen, node: p.node, text: p.text, tone: p.tone });
  }
  const n = sp.pages.length;
  const avg = W / Math.max(1, S);
  const rate = (longS + fig + pers + vague + hintPoetry * 1.5 + longW * 0.3 + frag * 0.3) / n;
  // score: 5 clean … 1 murky
  let score = 5 - Math.min(4, rate * 2.2) - Math.max(0, (avg - 12) / 6);
  score = Math.max(1, Math.min(5, Math.round(score)));
  worst.sort((a, b) => b.pen - a.pen);
  out.push({ world: sp.world, name: sp.name, where: sp.where, pages: n, avgSentence: +avg.toFixed(1), longSentences: longS, figurative: fig, personified: pers, vagueOpen: vague, fragments: frag, hintPoetry, rate: +rate.toFixed(2), score, worst: worst.slice(0, 3).filter((w) => w.pen > 0) });
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
const hist = [1, 2, 3, 4, 5].map((s) => out.filter((o) => o.score === s).length);
console.log('speakers', out.length, 'score hist 1..5', hist.join(' '));
for (const o of out.filter((o) => o.score <= 2).sort((a, b) => a.score - b.score || b.rate - a.rate)) console.log(o.score, o.world, o.name, o.pages, o.avgSentence, o.rate);
