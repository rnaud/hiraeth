// A small Markdown reader for the audits page (audits.html, src/audits-page/): the reports in docs/audits/ are
// written in a plain subset (headings, paragraphs, nested lists, tables, pictures, links, bold, italic, code), and
// this turns them into HTML at build time (scripts/audits-data.mjs), so the page carries no Markdown library.
//
//   toHtml(md, { link })     the HTML of a block of Markdown; link(href, { image }) rewrites each link and picture
//   inline(text, { link })   one line's inline Markdown
//   splitRow(line)           a table row's cells (raw Markdown)
//   plain(text)              the words alone (no Markdown marks)
//
// A link to a picture becomes a thumbnail button (data-path: the page opens it full size); a paragraph of
// pictures becomes a figure, with the italic paragraph under it as its caption.

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const IMAGE = /\.(webp|png|jpe?g|gif|svg)$/i;

/** The words of a bit of inline Markdown, without its marks. */
export function plain(text) {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1$2')
    .replace(/(^|\W)_([^_\s][^_]*?)_(?!\w)/g, '$1$2')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

/** A table row's cells (raw Markdown), the outer pipes dropped; a pipe inside `code` stays in its cell. */
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') code = !code;
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const isRow = (line) => /^\s*\|/.test(line);

/** One line's inline Markdown as HTML. */
export function inline(text, { link = (h) => h } = {}) {
  const codes = [];
  let s = String(text ?? '').replace(/<!--.*?-->/g, '').replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  // pictures, then links (a link to a picture: a thumbnail the page opens full size)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, href) => {
    const path = link(href.replace(/&amp;/g, '&'), { image: true });
    return `<img alt="${alt}" data-path="${esc(path)}" loading="lazy" decoding="async">`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const raw = href.replace(/&amp;/g, '&');
    if (IMAGE.test(raw.split('#')[0])) {
      const path = link(raw, { image: true });
      return `<button class="thumb" type="button" data-path="${esc(path)}" data-nav tabindex="0" title="${label}"><img alt="" data-path="${esc(path)}" loading="lazy" decoding="async"><span>${label}</span></button>`;
    }
    const to = link(raw, { image: false });
    const ext = /^https?:/.test(to);
    return `<a href="${esc(to)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,;:)!?]|$)/g, '$1<i>$2</i>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

/** A table (its lines) as HTML. */
export function tableHtml(lines, opts = {}) {
  const head = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  const th = head.map((h) => `<th>${inline(h, opts)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? '', opts)}</td>`).join('')}</tr>`).join('');
  return `<div class="table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

const indentOf = (line) => line.match(/^\s*/)[0].replace(/\t/g, '    ').length;
const listMark = (line) => line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);

/** A list (its lines, the first one a marker) as HTML; nested by indentation. */
function listHtml(lines, opts) {
  const base = indentOf(lines[0]);
  const ordered = /^\s*\d/.test(lines[0]);
  const start = ordered ? parseInt(lines[0].trim(), 10) : 1;
  const items = [];
  for (const line of lines) {
    const m = listMark(line);
    if (m && indentOf(line) === base) items.push({ first: m[3], rest: [] });
    else if (items.length) items.at(-1).rest.push(line);
  }
  const li = items.map(({ first, rest }) => {
    const text = [first];
    let i = 0;
    while (i < rest.length && !listMark(rest[i]) && rest[i].trim()) { text.push(rest[i].trim()); i++; }
    const more = rest.slice(i).filter((l, k, a) => l.trim() || (k > 0 && k < a.length - 1));
    const check = text[0].match(/^\[( |x)\]\s+/i);
    if (check) text[0] = text[0].slice(check[0].length);
    const box = check ? `<span class="check${check[1].trim() ? ' done' : ''}">${check[1].trim() ? '✓' : ''}</span>` : '';
    return `<li${check ? ' class="task"' : ''}>${box}${inline(text.join(' '), opts)}${more.length ? toHtml(dedent(more).join("\n"), opts) : ''}</li>`;
  }).join('');
  return ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${li}</ol>` : `<ul>${li}</ul>`;
}

function dedent(lines) {
  const n = Math.min(...lines.filter((l) => l.trim()).map(indentOf));
  return lines.map((l) => l.replace(/^\t/, '    ').slice(Math.min(n, indentOf(l))));
}

/** A block of Markdown as HTML (see the top). */
export function toHtml(md, opts = {}) {
  const lines = String(md ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [];
  let i = 0;
  let lastFigure = -1;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    // a fenced block
    if (/^\s*```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2], opts)}</h${h[1].length}>`); i++; continue; }
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const t = [];
      while (i < lines.length && isRow(lines[i])) t.push(lines[i++]);
      out.push(tableHtml(t, opts));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${toHtml(q.join('\n'), opts)}</blockquote>`);
      continue;
    }
    if (listMark(line)) {
      const base = indentOf(line);
      const num = (x) => /^\s*\d/.test(x), type = num(line);   // (a bulleted list and a numbered one are two lists)
      const l = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) {
          // a blank line ends the list unless the next line carries on (indented, or another item at this depth)
          const next = lines[i + 1] ?? '';
          if (next.trim() && (indentOf(next) > base || (listMark(next) && indentOf(next) === base && num(next) === type))) { l.push(cur); i++; continue; }
          break;
        }
        if (indentOf(cur) < base) break;
        if (indentOf(cur) === base && listMark(cur) && num(cur) !== type) break;
        if (indentOf(cur) === base && !listMark(cur)) {
          // a lazy continuation of the item above, unless it starts something else
          if (/^\s*(#|\||>|```)/.test(cur)) break;
        }
        l.push(cur); i++;
      }
      out.push(listHtml(l, opts));
      continue;
    }
    // a paragraph
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i]) && !listMark(lines[i]) && !/^\s*(```|>)/.test(lines[i]) && !(isRow(lines[i]) && isSep(lines[i + 1] ?? ''))) p.push(lines[i++].trim());
    const text = p.join(' ');
    if (/^(\s*!\[[^\]]*\]\([^)]+\)\s*)+$/.test(text)) {
      out.push(`<figure>${inline(text, opts)}</figure>`);
      lastFigure = out.length - 1;
      continue;
    }
    // an italic paragraph right under a figure: its caption
    if (lastFigure === out.length - 1 && /^\*[^*].*\*$/.test(text)) {
      out[lastFigure] = out[lastFigure].replace('</figure>', `<figcaption>${inline(text.slice(1, -1), opts)}</figcaption></figure>`);
      continue;
    }
    out.push(`<p>${inline(text, opts)}</p>`);
  }
  return out.join('\n');
}
