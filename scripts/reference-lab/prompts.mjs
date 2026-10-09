// The reference lab's prompts (docs/systems/reference-lab.md): the prompt documents (docs/**/*prompts*.md, e.g.
// docs/design/enemy-roster-prompts.md: a `### N. Name (\`id\`)` heading, then its fenced prompts, each under a
// bold line such as **Main sheet: …** or **Alternate skin: …**) and the prompts already recorded in the
// references' manifests (references/**/*.json: "prompt" fields, e.g. the title covers).
//
// The documents are written for Midjourney: cleanMidjourney() turns one into a plain prompt (the --ar flag
// becomes the aspect ratio, the --no list a closing "Avoid: …" sentence, the image-URL placeholder goes).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { insideRoot } from './common.mjs';

/** A Midjourney prompt as a plain one: { prompt, ar, negative } (pure). */
export function cleanMidjourney(text) {
  let t = String(text ?? '').trim().replace(/^\[[^\]]*image URL[^\]]*\]\s*/i, '');
  let ar = null, negative = '';
  const flags = t.search(/\s--[a-z]/i);
  if (flags >= 0) {
    const tail = t.slice(flags);
    t = t.slice(0, flags).trim();
    ar = tail.match(/--ar\s+(\d+:\d+)/)?.[1] ?? null;
    const no = tail.match(/--no\s+(.*?)(?=\s--[a-z]|$)/i)?.[1]?.trim();
    if (no) negative = no.split(/[\s,]+/).filter(Boolean).map((w) => w.replace(/-/g, ' ')).join(', ');
  }
  return { prompt: negative ? `${t}. Avoid: ${negative}.` : t, ar, negative };
}

/** A prompt document's entries: [{ id, title, variants: [{ key, label, prompt, ar, raw }] }] (pure). */
export function parsePromptDoc(md) {
  const out = [];
  let cur = null, label = '', inFence = false, buf = [];
  for (const line of String(md).split(/\r?\n/)) {
    if (inFence) {
      if (/^```/.test(line)) {
        inFence = false;
        if (cur) {
          const raw = buf.join('\n').trim(), clean = cleanMidjourney(raw);
          const key = cur.variants.length === 0 ? 'main' : /alternate|alt\b|skin/i.test(label) ? `alt${cur.variants.filter((v) => v.key.startsWith('alt')).length || ''}` : `v${cur.variants.length + 1}`;
          cur.variants.push({ key, label: label || key, prompt: clean.prompt, ar: clean.ar, raw, needsImage: /^\[[^\]]*image URL/i.test(raw) });
        }
        buf = []; label = '';
      } else buf.push(line);
      continue;
    }
    const h = line.match(/^#{2,4}\s+(?:\d+\.\s*)?(.*?)\s*\(`([\w-]+)`\)\s*$/);
    if (h) { cur = { id: h[2], title: h[1].trim(), variants: [] }; out.push(cur); label = ''; continue; }
    if (/^#{1,3}\s/.test(line)) { cur = null; continue; }
    const b = line.match(/^\*\*(.+?)\*\*/);
    if (b) label = b[1].replace(/[.:]\s*$/, '');
    if (/^```/.test(line)) { inFence = true; buf = []; }
  }
  return out.filter((e) => e.variants.length);
}

/** The prompt documents: docs/**\/*prompts*.md (relative paths). */
export function promptDocs(root) {
  const out = [];
  const walk = (dir) => {
    for (const f of readdirSync(join(root, dir))) {
      const rel = `${dir}/${f}`;
      if (f === 'archive' || f.startsWith('.')) continue;
      const st = statSync(join(root, rel));
      if (st.isDirectory()) walk(rel);
      else if (/prompts?.*\.md$/i.test(f)) out.push(rel);
    }
  };
  if (existsSync(join(root, 'docs'))) walk('docs');
  return out.sort();
}

/**
 * The suggested target folder for an entry of a document: the document's own `Target folder: \`references/…/<id>/\``
 * line when it has one, else the enemy archetypes' folder, else references/<id>/.
 */
export function targetFor(doc, id, text = '') {
  const own = String(text).match(/^Target folder: `(references\/[^`]*<id>[^`]*)`/m)?.[1];
  if (own) return own.replace('<id>', id);
  return /enemy-roster/.test(doc) ? `references/enemy-archetypes/${id}/` : `references/${id}/`;
}

/** The prompts recorded in the references' manifests: [{ source, label, prompt, ar }], unique by prompt. */
export function manifestPrompts(root, dir = 'references') {
  const seen = new Set(), out = [];
  const visit = (node, file, label) => {
    if (Array.isArray(node)) { node.forEach((n) => visit(n, file, label)); return; }
    if (!node || typeof node !== 'object') return;
    const here = node.label ?? node.file ?? node.name ?? node.title ?? label;
    if (typeof node.prompt === 'string' && node.prompt.length > 40 && !seen.has(node.prompt)) {
      seen.add(node.prompt);
      const c = cleanMidjourney(node.prompt);
      out.push({ source: file, label: String(here ?? file.split('/').pop()), prompt: c.prompt, ar: c.ar });
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') visit(v, file, here);
  };
  const walk = (rel, depth) => {
    if (depth > 4 || !existsSync(join(root, rel))) return;
    for (const f of readdirSync(join(root, rel))) {
      if (f.startsWith('_') || f.startsWith('.')) continue;
      const p = `${rel}/${f}`, st = statSync(join(root, p));
      if (st.isDirectory()) walk(p, depth + 1);
      else if (f.endsWith('.json') && st.size < 2_000_000) { try { visit(JSON.parse(readFileSync(join(root, p), 'utf8')), p); } catch { /* not JSON */ } }
    }
  };
  walk(dir, 0);
  return out;
}

/** Everything the page offers: { docs: [{ doc, entries }], manifests: [...] }. */
export function listPrompts(root) {
  return {
    docs: promptDocs(root).map((doc) => { const text = readFileSync(join(root, doc), 'utf8'); return { doc, entries: parsePromptDoc(text).map((e) => ({ ...e, target: targetFor(doc, e.id, text) })) }; }),
    manifests: manifestPrompts(root),
  };
}

/**
 * `docs/design/enemy-roster-prompts.md#crab` (the main prompt) or `…#crab/alt` (another variant by key) →
 * { prompt, ar, title, id, variant, target, from, needsImage }.
 */
export function resolveFrom(root, from) {
  const [file, frag = ''] = String(from).split('#');
  const { abs, rel } = insideRoot(root, file);
  if (!existsSync(abs)) throw new Error(`no prompt document ${rel}`);
  const [id, key = 'main'] = frag.split('/');
  const text = readFileSync(abs, 'utf8');
  const entries = parsePromptDoc(text);
  const e = entries.find((x) => x.id === id);
  if (!e) throw new Error(`no "${id}" in ${rel} (there: ${entries.map((x) => x.id).join(', ')})`);
  const v = e.variants.find((x) => x.key === key) ?? (key === 'alt' ? e.variants.find((x) => x.key.startsWith('alt')) : null);
  if (!v) throw new Error(`no variant "${key}" for ${id} (there: ${e.variants.map((x) => x.key).join(', ')})`);
  return { prompt: v.prompt, ar: v.ar, title: e.title, id, variant: v.key, target: targetFor(rel, id, text), from: `${rel}#${id}${v.key === 'main' ? '' : `/${v.key}`}`, needsImage: v.needsImage };
}
