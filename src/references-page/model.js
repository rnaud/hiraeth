// The references page's model (references.html, docs/systems/references.md "The references page"): pure
// functions over the index the dev server builds (scripts/references-index.mjs): what kind of reference a
// path is, the folder tree, the filters and search, the address (#path=…). The page (main.js) and the tests
// share them.

/** The folders at the top of references/ that belong to no world: their kind and their label. */
export const TOP_FOLDERS = {
  'The Travellers Ship': { kind: 'ship', label: 'The Traveller’s Ship' },
  'main character': { kind: 'main', label: 'Main character' },
  'Core Objects': { kind: 'objects', label: 'Core objects' },
  'enemy-archetypes': { kind: 'archetypes', label: 'Enemy archetypes' },
  'Title Screen': { kind: 'title', label: 'Title screen' },
};

/** The kinds, in the order the filter offers them. */
export const KINDS = [
  { id: 'environment', label: 'Environment' },
  { id: 'characters', label: 'Characters' },
  { id: 'places', label: 'Places' },
  { id: 'ship', label: 'Ship' },
  { id: 'main', label: 'Main character' },
  { id: 'objects', label: 'Core objects' },
  { id: 'archetypes', label: 'Enemy archetypes' },
  { id: 'title', label: 'Title screen' },
  { id: 'other', label: 'Other' },
  { id: 'archive', label: 'Archive' },
];

/** The tree's virtual nodes: the reference lab's picks wherever they are, the loose files at the top. */
export const LAB = '~lab';
export const LOOSE = '~loose';

const IMAGE = /\.(jpe?g|png|webp)$/i;
export const isImagePath = (p) => IMAGE.test(String(p ?? ''));

/**
 * What a picture is, from its path under references/ ("levels/The Desert/environment/IMG_3775.JPG"):
 * { world, kind } (world null for the folders that belong to none).
 */
export function classify(rel) {
  const parts = String(rel).replace(/^references\//, '').split('/');
  if (parts[0] === 'levels' && parts.length >= 3) return { world: parts[1], kind: parts.length >= 4 ? parts[2] : 'environment' };
  if (parts[0] === 'archive') return { world: parts[1] === 'world-enemies' && parts.length >= 4 ? parts[2] : null, kind: 'archive' };
  if (parts.length > 1 && TOP_FOLDERS[parts[0]]) return { world: null, kind: TOP_FOLDERS[parts[0]].kind };
  return { world: null, kind: 'other' };
}

/** Is `folder` (relative to references/, "." the top) inside the tree node `sel`? */
export function inNode(folder, sel) {
  if (!sel) return true;
  if (sel === LOOSE) return folder === '.';
  return folder === sel || folder.startsWith(`${sel}/`);
}

/** Does the selection or the filters ask for the archive? (else it stays out of the results) */
export const wantsArchive = (f = {}) => f.kind === 'archive' || String(f.sel ?? '').startsWith('archive');

/** Search words: every one must be in the picture's path (folder and name), its title or its prompt. */
export function matchesQuery(e, q) {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${e.rel} ${e.meta?.title ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * The pictures shown for a selection and the filters: { sel, q, world, kind, lab, prompt }.
 * The archive only when asked for; the lab node is the lab filter.
 */
export function filterEntries(entries, f = {}) {
  const archive = wantsArchive(f);
  const lab = f.lab || f.sel === LAB;
  const sel = f.sel === LAB ? '' : f.sel;
  return entries.filter((e) => (archive || e.kind !== 'archive')
    && inNode(e.folder, sel)
    && (!f.world || e.world === f.world)
    && (!f.kind || e.kind === f.kind)
    && (!lab || e.lab)
    && (!f.prompt || e.hasPrompt)
    && matchesQuery(e, f.q));
}

/** The worlds in the index, sorted ("The " ignored). */
export function worldsOf(entries) {
  const key = (w) => w.replace(/^The /, '');
  return [...new Set(entries.filter((e) => e.kind !== 'archive' && e.world).map((e) => e.world))].sort((a, b) => key(a).localeCompare(key(b)));
}

/**
 * The tree: [{ id, label, count, children, closed }] — Levels (each world, then its kinds), the folders that
 * belong to no world (and their first folders), the loose files, the lab's picks, then the archive (closed).
 */
export function buildTree(entries) {
  const count = (pred) => entries.filter(pred).length;
  const sub = (prefix, depthLabel = (s) => s) => {
    const names = [...new Set(entries.filter((e) => e.folder.startsWith(`${prefix}/`)).map((e) => e.folder.slice(prefix.length + 1).split('/')[0]))];
    return names.sort((a, b) => a.localeCompare(b)).map((n) => ({ id: `${prefix}/${n}`, label: depthLabel(n), count: count((e) => inNode(e.folder, `${prefix}/${n}`)), children: [] }));
  };
  const KIND_ORDER = ['environment', 'characters', 'places'];
  const levels = {
    id: 'levels', label: 'Levels', count: count((e) => inNode(e.folder, 'levels')),
    children: worldsOf(entries).map((w) => ({
      id: `levels/${w}`, label: w, count: count((e) => inNode(e.folder, `levels/${w}`)),
      children: sub(`levels/${w}`).sort((a, b) => KIND_ORDER.indexOf(a.id.split('/').pop()) - KIND_ORDER.indexOf(b.id.split('/').pop())),
      closed: true,
    })),
  };
  const tops = Object.entries(TOP_FOLDERS).filter(([f]) => count((e) => inNode(e.folder, f))).map(([f, t]) => ({ id: f, label: t.label, count: count((e) => inNode(e.folder, f)), children: sub(f), closed: true }));
  const others = [...new Set(entries.filter((e) => e.kind === 'other' && e.folder !== '.').map((e) => e.folder.split('/')[0]))]
    .map((f) => ({ id: f, label: f, count: count((e) => inNode(e.folder, f)), children: sub(f), closed: true }));
  const loose = count((e) => e.folder === '.');
  const archived = count((e) => e.kind === 'archive');
  const archive = { id: 'archive', label: 'Archive', count: archived, closed: true, archive: true, children: sub('archive').map((n) => ({ ...n, children: sub(n.id), closed: true })) };
  return [
    levels, ...tops, ...others,
    ...(loose ? [{ id: LOOSE, label: 'Loose at the top', count: loose, children: [] }] : []),
    { id: LAB, label: 'Lab picks', count: count((e) => e.lab), children: [] },
    ...(archived ? [archive] : []),
  ];
}

/** Every node's id in the order the tree draws them (the open ones' children too): for LB / RB. */
export function flatIds(tree, open = new Set()) {
  const out = [];
  const walk = (nodes) => { for (const n of nodes) { out.push(n.id); if (n.children?.length && open.has(n.id)) walk(n.children); } };
  walk(tree);
  return out;
}

/** The ids of the nodes above a folder (to open the tree down to it). */
export function ancestors(folder) {
  const parts = String(folder ?? '').split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}

/** The folder of a picture's path (LOOSE at the top). */
export const folderOf = (rel) => (String(rel).includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : LOOSE);

/** The page's address: #path=<folder or picture>&q=…&world=…&kind=…&lab=1&prompt=1 → the state; and back. */
export function parseHash(hash = '') {
  const p = new URLSearchParams(String(hash).replace(/^#/, ''));
  const path = p.get('path') ?? '';
  const pic = isImagePath(path) ? path : null;
  // (a picture opened from a wider folder keeps it: &in=<folder>, "*" for All)
  const inn = p.get('in');
  const sel = pic ? (inn != null ? (inn === '*' ? '' : inn) : folderOf(pic)) : path;
  return { sel, pic, q: p.get('q') ?? '', world: p.get('world') ?? '', kind: p.get('kind') ?? '', lab: p.get('lab') === '1', prompt: p.get('prompt') === '1' };
}
export function formatHash(s = {}) {
  const p = new URLSearchParams();
  const path = s.pic ?? s.sel ?? '';
  if (path) p.set('path', path);
  if (s.pic && (s.sel ?? '') !== folderOf(s.pic)) p.set('in', s.sel || '*');
  if (s.q) p.set('q', s.q);
  if (s.world) p.set('world', s.world);
  if (s.kind) p.set('kind', s.kind);
  if (s.lab) p.set('lab', '1');
  if (s.prompt) p.set('prompt', '1');
  const out = p.toString().replace(/\+/g, '%20');
  return out ? `#${out}` : '#';
}

/** 1234567 → "1.2 MB". */
export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Group the pictures shown by folder, in the index's order: [{ folder, entries }]. */
export function groupByFolder(entries) {
  const out = [], at = new Map();
  for (const e of entries) {
    if (!at.has(e.folder)) { at.set(e.folder, { folder: e.folder, entries: [] }); out.push(at.get(e.folder)); }
    at.get(e.folder).entries.push(e);
  }
  return out;
}
