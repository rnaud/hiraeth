// The Unity bridge's gaps (issue #428): what the web game uses that the bridge doesn't carry, gathered four ways, and
// held against engine/bridge-gaps.js (every one there handled, web only or a known gap with its issue).
//
//   materials  every material the game makes, as the bridge sees it: the engines' bundle (engine/game.js) run in node
//              in every world and minigame, each material put through the port's own classification
//              (engine/unity/port-format.js portMaterial); a shader with no port of its own, three's other materials,
//              and the defines and uniforms of makeMaterial's surface that the port never reads (so Unity never gets)
//   shaders    the places src/ makes a ShaderMaterial, hooks onBeforeCompile or makes one of three's lit materials
//   passes     what the page draws outside the main scene's pass: a scene of its own, another renderer.render, an
//              object's own render(renderer)
//   dom        the page's own elements a system builds (createElement but canvases, innerHTML, getElementById…)
//   host       what src/main.js sets up that engine/game.js doesn't: the modules' names it imports, its own functions
//
//   node scripts/bridge-gaps.mjs            writes docs/systems/bridge-gaps.md from engine/bridge-gaps.js
//   node scripts/bridge-gaps.mjs --check    gathers everything and prints what isn't listed, or is listed but gone
//
// tests/bridge-gaps.test.js runs the check. docs/systems/engine-bridge.md, "Loud gaps".
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAPS, DEV_PAGES, STATUSES } from '../engine/bridge-gaps.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPORT = 'docs/systems/bridge-gaps.md';

function walk(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir)).sort()) {
    const p = `${dir}/${f}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (f.endsWith('.js') && !f.endsWith('.test.js')) out.push(p);
  }
  return out;
}
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** The code without its comments (strings left: a shader's text is code too). */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
/** A dev page's file (its own HTML page, a tool), web only by category: the entry of DEV_PAGES it comes under. */
export const devPage = (file) => DEV_PAGES.find((d) => file === d.path || (d.path.endsWith('/') && file.startsWith(d.path))) ?? null;
const count = (s, re) => (s.match(re) ?? []).length;

// ------------------------------------------------------------------ static
/** Where src/ makes its own shaders and three's lit materials: `site:<file>:<kind>` → { count }. */
export function gatherShaders() {
  const out = new Map();
  for (const f of walk('src')) {
    if (devPage(f)) continue;
    const s = code(read(f));
    const n = {
      ShaderMaterial: count(s, /new\s+(?:THREE\.|T\.)?(?:Raw)?ShaderMaterial\s*\(/g),
      onBeforeCompile: count(s, /\.onBeforeCompile\s*=/g),
    };
    for (const m of s.matchAll(/new\s+(?:THREE\.|T\.)?(Mesh(?:Lambert|Standard|Phong|Physical|Toon|Normal|Depth|Matcap|Distance)Material|LineDashedMaterial|ShadowMaterial)\s*\(/g)) n[m[1]] = (n[m[1]] ?? 0) + 1;
    for (const [k, c] of Object.entries(n)) if (c) out.set(`site:${f}:${k}`, { count: c });
  }
  return out;
}

/** What the page draws besides the main scene's G-buffer pass: `<file>: <call>` → { line }. */
export function gatherPasses() {
  const out = new Map();
  for (const f of walk('src')) {
    if (devPage(f)) continue;
    const lines = read(f).split('\n');
    lines.forEach((raw, i) => {
      const l = code(raw);
      const add = (k) => { if (!out.has(`${f}: ${k}`)) out.set(`${f}: ${k}`, { line: i + 1 }); };
      // a renderer drawing a scene (or an object) of its own: renderer.render(x, cam)
      for (const m of l.matchAll(/\b(renderer_?|R|r)\.render\(\s*([\w.]+)/g)) add(`render(${m[2]})`);
      // an object drawing itself with the renderer: HOLO.render(renderer, …), smaa.render(renderer, …)
      for (const m of l.matchAll(/([\w.]+)\??\.render\(\s*(?:renderer_?|R)\s*[,)]/g)) add(`${m[1]}.render(renderer)`);
      // a scene of its own
      for (const m of l.matchAll(/(?:(?:const|let|var)\s+([\w]+)|([\w.]+)\s*=|(\w+)\s*:)\s*new\s+THREE\.Scene\(\)/g)) add(`new Scene ${m[1] ?? m[2] ?? m[3]}`);
    });
  }
  return out;
}

/** The page's elements the systems build: `<file>` → { count, parts } (the screen's parts the file sets too). */
export function gatherDom() {
  const out = new Map();
  // (any document: a module handed one, `doc`, as charge.js is; canvases left out, most are pictures for a texture)
  const re = /\.createElement(?:NS)?\(\s*(?:[^,)]*,\s*)?(?!['"`]canvas['"`])|\.(?:inner|outer)HTML\s*\+?=|insertAdjacentHTML\(|\.getElementById\(|page\.byId\(|\.body\.(?:append|appendChild|prepend|insertBefore)\(/g;
  for (const f of walk('src')) {
    if (devPage(f)) continue;
    const s = code(read(f));
    const n = count(s, re);
    if (!n) continue;
    const parts = [...new Set([...s.matchAll(/screen\.set\(\s*'(\w+)'/g)].map((m) => m[1]))].sort();
    out.set(f, { count: n, parts });
  }
  // and the screen's parts a system sets (src/platform.js screen) that the bridge never reads: drawn by nothing in Unity
  const drawn = bridgeParts();
  for (const f of walk('src')) {
    if (devPage(f)) continue;
    for (const m of code(read(f)).matchAll(/screen\.set\(\s*'(\w+)'/g)) if (!drawn.has(m[1]) && !out.has(`part:${m[1]}`)) out.set(`part:${m[1]}`, { file: f });
  }
  return out;
}

/** The screen's parts the bridge draws: the names BridgeHud / BridgeMenu read off the screen's state (state.O("charge"), s.O("drums")…). */
export function bridgeParts() {
  const dir = 'unity/Hiraeth/Assets/HiraethJS/Runtime';
  const cs = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.cs')).map((f) => read(`${dir}/${f}`)).join('\n');
  return new Set([...cs.matchAll(/(?:\.[A-Z]\w*|\bPart)\(\s*"(\w+)"/g)].map((m) => m[1]));   // (Part("x"): BridgeHud's, the part unless the page's rules hide it)
}

/** main.js's imports from src/ and its own functions, against what engine/game.js and engine/ use. */
export function gatherHost() {
  const imports = (s, base) => {
    const out = [];
    for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      if (!m[2].startsWith('.')) continue;
      const mod = relative(ROOT, resolve(ROOT, base, m[2]));
      for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) out.push(`${mod}#${n}`);
    }
    for (const m of s.matchAll(/import\s+(\w+)\s+from\s*'([^']+)'/g)) if (m[2].startsWith('.')) out.push(`${relative(ROOT, resolve(ROOT, base, m[2]))}#default`);
    return out;
  };
  const main = code(read('src/main.js'));
  // (not this list: it names them all)
  const engineFiles = ['engine', 'engine/unity'].flatMap((d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.js') && f !== 'bridge-gaps.js').map((f) => `${d}/${f}`));
  // (a function of main.js's is there when the engines name it, in a comment too: their way is "as main.js armTool")
  const engine = engineFiles.map((f) => read(f)).join('\n');
  const engineImports = new Set(engineFiles.flatMap((f) => imports(code(read(f)), dirname(f))));
  const out = new Map();
  for (const k of new Set(imports(main, 'src'))) if (!engineImports.has(k)) out.set(`import:${k}`, {});
  const own = new Set();
  for (const m of main.matchAll(/^(?:async\s+)?function\s+(\w+)|^(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/gm)) own.add(m[1] ?? m[2]);
  for (const n of own) if (!new RegExp(`\\b${n}\\b`).test(engine)) out.set(`fn:${n}`, {});
  return out;
}

// ------------------------------------------------------------------ materials, by running the engines' game
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);

/**
 * Every world and minigame played a few frames in the engines' bundle; what the port can't take: `<key>` → { n, where }.
 * opts: { worlds, games } (default: all), log (each run's time).
 */
export async function gatherMaterials({ worlds = null, games = null, log = () => {} } = {}) {
  const { tmpdir } = await import('node:os');
  const { bundle } = await import('./engine-bundle.mjs');
  const { loadBundle } = await import('../engine/vm-run.mjs');
  const { tempPath } = await import('./temp-dirs.mjs');
  const { portMaterial, unmappedKey } = await import('../engine/unity/port-format.js');
  const { LIVE_VECTORS } = await import('../engine/mirror.js');
  const { LEVELS } = await import('../src/levels/index.js');
  // (sent besides the port's material: the live colour and glow, the moving vectors, the picture: engine/mirror.js, backend.js)
  const LIVE = new Set([...LIVE_VECTORS, 'uColor', 'uGlow', 'uWash', 'uMap', 'uHasMap']);
  const file = tempPath(join(tmpdir(), `hiraeth-bridge-gaps-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] }).exports;
  const out = new Map();
  let at = '';
  const note = (key, name) => {
    let e = out.get(key);
    if (!e) out.set(key, e = { n: 0, where: new Set(), names: new Set() });
    e.n++; e.where.add(at); if (name && e.names.size < 3) e.names.add(name);
  };
  const tracked = (o, seen) => new Proxy(o, { get: (t, p) => { seen.add(p); return t[p]; }, has: (t, p) => { seen.add(p); return p in t; } });
  const backend = new Proxy({}, {
    get: (t, k) => (k === 'material' ? (mid, spec) => {
      const U = new Set(), D = new Set();
      const pm = portMaterial({ ...spec, u: tracked(spec.u, U), defines: tracked(spec.defines, D) }, mid);
      if (pm.port) return;
      if (spec.type === 'shader' || spec.type === 'other') { note(unmappedKey(spec), spec.name); return; }
      if (spec.type !== 'ink') return;   // (a plain colour: the Surface's plain, its picture sent: handled)
      for (const k of Object.keys(spec.defines)) if (!D.has(k)) note(`define:${k}`, spec.name);
      for (const k of Object.keys(spec.u)) if (!U.has(k) && !LIVE.has(k)) note(`uniform:${k}`, spec.name);
    } : UNSET.has(k) ? undefined : () => {}),
  });
  const menus = () => ({ shown: [], open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
  const play = async (label, opts) => {
    at = label;
    const t = Date.now();
    try {
      const g = await B.createGame({ backend, menus: menus(), ...opts });
      for (let f = 0; f < 8; f++) g.frame(1 / 20);
      await new Promise((r) => setTimeout(r, 30));
      for (let f = 0; f < 8; f++) g.frame(1 / 20);
      g.trials?.runner?.end?.();
    } catch (e) { log(`${label}: ${e?.message ?? e}`); }
    log(`${label} ${Date.now() - t} ms`);
  };
  // (the worlds' own chatter hushed the while: a world loads things a bare VM can't, and says so)
  const c = console, said = { warn: c.warn, info: c.info, log: c.log, error: c.error };
  const say = log === console.log ? said.log : log;
  log = say;
  c.warn = c.info = c.log = c.error = () => {};
  try {
    for (const L of LEVELS) if (!worlds || worlds.includes(L.id)) await play(L.id, { levelId: L.id });
    // the opening (the father's hologram, the wake), as a new game starts it
    if (!worlds || worlds.includes('prologue')) await play('prologue', { levelId: 'desert', prologue: true });
    for (const G of B.GAMES ?? []) if (!games || games.includes(G.id)) await play(`game ${G.id}`, { levelId: G.world ?? 'desert', game: G.id, from: G.world ?? 'desert' });
    await new Promise((r) => setTimeout(r, 200));
  } finally { Object.assign(c, said); }
  for (const e of out.values()) { e.where = [...e.where]; e.names = [...e.names]; }
  return out;
}

// ------------------------------------------------------------------ against the list
const KINDS = ['materials', 'shaders', 'passes', 'dom', 'host'];
/** The entry of GAPS[kind] that names `key` (by its keys, or a pattern), or null. */
export function entryFor(kind, key) {
  return GAPS[kind].find((e) => e.keys?.includes(key) || e.pattern?.test(key)) ?? null;
}

/**
 * What was found against the list: unlisted (found, in no entry), stale (an entry's key not found any more), counts
 * (a counted entry whose count moved: a site added or taken away), bad (a 'handled' screen part the bridge never reads).
 */
export function compare(kind, found, { parts = null } = {}) {
  const unlisted = [], stale = [], counts = [], bad = [];
  for (const [key, v] of found) {
    const e = entryFor(kind, key);
    if (!e) { unlisted.push({ key, ...v }); continue; }
    const want = e.count?.[key];
    if (want !== undefined && v.count !== want) counts.push({ key, was: want, now: v.count });
  }
  for (const e of GAPS[kind]) for (const k of e.keys ?? []) if (!found.has(k)) stale.push(k);
  if (parts) for (const e of GAPS[kind]) for (const p of e.parts ?? []) if (!parts.has(p)) bad.push(`${e.keys?.[0]}: '${p}'`);
  return { unlisted, stale, counts, bad };
}

/** Every entry's shape: a status of STATUSES, its reason, its issue when a gap. */
export function checkEntries() {
  const bad = [];
  for (const kind of KINDS) for (const e of GAPS[kind]) {
    const id = `${kind}: ${e.keys?.[0] ?? e.pattern}`;
    if (!STATUSES.includes(e.status)) bad.push(`${id}: status '${e.status}'`);
    if (!e.what) bad.push(`${id}: no 'what'`);
    if (e.status === 'gap' && !(e.issue > 0)) bad.push(`${id}: a gap without its issue`);
    if (e.status === 'handled' && !e.where) bad.push(`${id}: handled, but not said where`);
    if (e.status === 'web-only' && !e.why) bad.push(`${id}: web only, but not said why`);
    if (!e.keys?.length && !e.pattern) bad.push(`${id}: no keys`);
    // (the counted kinds: a site added to a file already listed is looked at too)
    if (kind === 'shaders' || kind === 'dom') for (const k of e.keys ?? []) if (!k.startsWith('part:') && !(e.count?.[k] > 0)) bad.push(`${kind}: ${k}: no count`);
  }
  for (const d of DEV_PAGES) if (!d.why) bad.push(`dev page ${d.path}: no 'why'`);
  return bad;
}

// ------------------------------------------------------------------ the report
const TITLES = {
  materials: 'Materials and shaders the bridge draws as something else',
  shaders: 'Where the game makes its own shaders',
  passes: 'Passes and scenes outside the main picture',
  dom: 'Page elements (HTML) the game builds',
  host: 'What src/main.js sets up that engine/game.js doesn\'t',
};
const RANK = { 3: 'seen at once', 2: 'seen in play', 1: 'barely seen', 0: 'not seen' };

/** docs/systems/bridge-gaps.md, from the list alone (so it changes only when the list does). */
export function reportMarkdown() {
  const L = ['# The Unity bridge\'s gaps', '',
    'Generated by `node scripts/bridge-gaps.mjs` from `engine/bridge-gaps.js` (issue #428). `tests/bridge-gaps.test.js`',
    'fails when the web game uses something the bridge doesn\'t carry and the list doesn\'t name, so nothing new slips',
    'through silently. Each kind lists the known gaps first, the most visible to a player at the top; then what is',
    'web only and why; then what the bridge handles and where. How it works: `docs/systems/engine-bridge.md`, "Loud gaps".', ''];
  const all = KINDS.flatMap((k) => GAPS[k].map((e) => ({ ...e, kind: k })));
  const n = (k, s) => all.filter((e) => e.kind === k && e.status === s).length;
  L.push('| Kind | Gaps | Web only | Handled |', '|---|---:|---:|---:|');
  for (const k of KINDS) L.push(`| ${TITLES[k]} | ${n(k, 'gap')} | ${n(k, 'web-only')} | ${n(k, 'handled')} |`);
  L.push(`| Dev pages and tools (web only by category) | | ${DEV_PAGES.length} | |`, '');
  const keys = (e) => { const k = e.keys ?? [`/${e.pattern.source}/`]; return k.slice(0, 4).map((x) => `\`${x}\``).join(', ') + (k.length > 4 ? ` and ${k.length - 4} more` : ''); };
  const end = (t) => (t && !/[.!?)]$/.test(t) ? `${t}.` : t ?? '');
  for (const k of KINDS) {
    L.push(`## ${TITLES[k]}`, '');
    const gaps = GAPS[k].filter((e) => e.status === 'gap').sort((a, b) => (b.visible ?? 0) - (a.visible ?? 0));
    if (gaps.length) {
      L.push('**Gaps**', '');
      for (const e of gaps) L.push(`- **${e.what}** (#${e.issue}, ${RANK[e.visible ?? 0]}). ${e.note ? `${end(e.note[0].toUpperCase() + e.note.slice(1))} ` : ''}${keys(e)}`);
      L.push('');
    }
    // (the rest briefly: what, and why or where)
    const web = GAPS[k].filter((e) => e.status === 'web-only');
    if (web.length) L.push(`**Web only**: ${web.map((e) => `${e.what} (${e.why})`).join('; ')}.`, '');
    const ok = GAPS[k].filter((e) => e.status === 'handled');
    if (ok.length) L.push(`**Handled**: ${ok.map((e) => `${e.what} (${e.where})`).join('; ')}.`, '');
  }
  L.push('## Dev pages and tools', '', `Their own HTML pages or developer tools, never in a player's game, not looked at for shaders, passes or page elements: ${DEV_PAGES.map((d) => `\`${d.path}\``).join(', ')}.`, '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const parts = bridgeParts();
    const show = (kind, r) => {
      for (const u of r.unlisted) console.log(`${kind} UNLISTED ${u.key}${u.count ? ` (${u.count})` : ''}${u.where ? ` in ${u.where.slice(0, 4).join(', ')}` : ''}${u.names?.length ? ` '${u.names.join("', '")}'` : ''}${u.parts?.length ? ` parts ${u.parts.join(',')}` : ''}`);
      for (const s of r.stale) console.log(`${kind} STALE ${s}`);
      for (const c of r.counts) console.log(`${kind} COUNT ${c.key}: listed ${c.was}, now ${c.now}`);
      for (const b of r.bad) console.log(`${kind} PART ${b}`);
    };
    for (const b of checkEntries()) console.log(`ENTRY ${b}`);
    show('shaders', compare('shaders', gatherShaders()));
    show('passes', compare('passes', gatherPasses()));
    show('dom', compare('dom', gatherDom(), { parts }));
    show('host', compare('host', gatherHost()));
    if (!process.argv.includes('--static')) show('materials', compare('materials', await gatherMaterials({ log: process.argv.includes('-v') ? console.log : () => {} })));
    process.exit(0);
  }
  writeFileSync(join(ROOT, REPORT), reportMarkdown());
  console.log(`wrote ${REPORT}`);
}
