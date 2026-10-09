// The temple design audit's measurements (.claude/skills/temple-design-qc/SKILL.md), in node, read-only
// against the game: every temple's rooms are built as the game builds them (src/temples/runtime.js, its
// layout, with no world round it), the pieces the layout places are recorded, and the puzzle graph is
// measured (scripts/temple-design/lib.mjs): locks and keys, mechanics taught / tested / twisted, steps
// that combine two verbs, how far each key is from its lock (rooms, metres, line of sight through the
// temple's own walls and shut doors), backtracking, reversible state, the guardian's link to the gadget,
// an obviousness score per step, and how alike the temples' shapes are.
//
//   node scripts/temple-design/audit.mjs [<out-dir>] [--temples desert,incal]
// Writes <out-dir>/report.json, <out-dir>/<id>-plan.svg (a top-down plan, lock → key lines coloured by how
// obvious each step is) and <out-dir>/views.json (camera views of each temple's most obvious steps, for
// scripts/design-qc/capture.mjs). Default <out-dir>: the system's temp folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'temple-design'));
mkdirSync(OUT, { recursive: true });

// a little DOM, as the node tests have it (some pieces build a canvas for their glyphs)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, append() {}, setAttribute() {}, set textContent(v) {}, set innerHTML(v) {}, get firstElementChild() { return el(); } });
const ctx2d = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ctx2d()), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? Object.assign(el(), { width: 1, height: 1, getContext: () => ctx2d(), toDataURL: () => '' }) : el()), body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, hidden: false };

const THREE = await import('three');
await import(join(ROOT, 'tests/register-gadgets.js'));
const { TEMPLES } = await import(join(ROOT, 'src/temples/index.js'));
const { TempleRuntime } = await import(join(ROOT, 'src/temples/runtime.js'));
const { solve } = await import(join(ROOT, 'src/temples/logic.js'));
const L = await import(join(ROOT, 'scripts/temple-design/lib.mjs'));
const { ORDER } = await import(join(ROOT, 'src/levels/names.js'));

// record what each layout places: the class and the options, before the piece is built
let record = null;
const add = TempleRuntime.prototype.add;
TempleRuntime.prototype.add = function (Piece, o) { record?.push({ cls: Piece.name, o }); return add.call(this, Piece, o); };
const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };

const ids = (arg('temples') ?? ORDER.filter((id) => TEMPLES[id]).join(',')).split(',').filter((id) => TEMPLES[id]);
const report = { date: new Date().toISOString(), temples: [] };
const graphs = {};
const views = [];
for (const id of ids) {
  const def = TEMPLES[id].def;
  record = [];
  const scene = new THREE.Scene();
  const rt = quiet(() => new TempleRuntime({ scene, level: { lights: [] }, def: { ...def, exterior: null, change: null }}));
  const pieces = record; record = null;
  scene.updateMatrixWorld(true);
  // line of sight in the temple's own frame: its walls, floors, pieces (doors shut as at the start), not the guardian
  const solids = [];
  rt.root.traverse((o) => { if (o.isMesh && o.geometry && !(rt.guardian && isUnder(o, rt.guardian.model?.group))) solids.push(o); });
  const ray = new THREE.Raycaster();
  const los = (a, b) => {
    const A = rt.kit.world(...a), B = rt.kit.world(...b), d = A.distanceTo(B);
    if (d < 0.5) return true;
    ray.set(A, B.clone().sub(A).normalize()); ray.far = d - 1.2;
    return ray.intersectObjects(solids, false).length === 0;
  };
  const s = solve(def.logic, { items: ['backpack'] });
  const g = L.puzzleGraph(def.logic, pieces, { los, order: s.order });
  const guardian = rt.guardian?.def ?? null;
  const m = L.templeMetrics(g, { guardian });
  graphs[id] = g;
  report.temples.push({ id, name: def.name, solved: s.done, skeleton: L.skeleton(g), graph: { rooms: g.rooms, order: g.roomOrder, chestRoom: g.chestRoom, locks: g.locks.map((l) => ({ id: l.id, a: l.a, b: l.b, type: l.type, mechanics: l.mechanics, keys: l.keys.map((k) => ({ id: k.id, how: k.how, room: k.room, metres: k.metres, rooms: k.rooms, visible: k.visible, mech: k.mech })), arena: l.arena, bossDoor: l.bossDoor })), traversal: g.traversal, pieces: countBy(pieces.map((p) => p.cls)) }, metrics: m });
  writeFileSync(join(OUT, `${id}-plan.svg`), L.planSvg(g, m, { title: `${def.name} (${id}): ${L.skeleton(g)}` }));
  // the two most obvious steps, seen from where you stand to face the lock, looking at the key
  for (const st of [...m.steps].sort((a, b) => b.obvious - a.obvious).slice(0, 2)) {
    const lock = g.locks.find((l) => l.id === st.lock);
    const key = lock?.keys.find((k) => k.pos);
    if (!lock?.stand || !lock.pos) continue;
    const eye = rt.kit.world(...backOff(lock.stand, lock.pos, 4)), look = rt.kit.world(...(key ? mid3(lock.pos, key.clue ?? key.pos) : lock.pos));
    views.push({ world: id, name: `temple-${id}-${st.lock}`, eye: eye.toArray().map(r2), target: look.toArray().map(r2), player: rt.kit.world(...lock.stand).sub(new THREE.Vector3(0, 1.7, 0)).toArray().map(r2), hour: 12, fov: 70, note: `${st.lock}: obviousness ${st.obvious} (${st.why.join('; ') || 'key beside the lock, in sight, one verb'})` });
  }
  rt.dispose?.();
  console.log(`${id.padEnd(10)} ${L.skeleton(g).padEnd(10)} steps ${m.steps.length}, combos ${m.combos}, obviousness ${m.obviousness.mean}, decoupled ${m.decoupled}, loops ${m.structure.cycles}, gadget ${m.gadget.uses}× (${m.gadget.contexts.join('/')}), guardian ${m.guardian.usesGadget ? 'asks the gadget' : 'no gadget'}`);
}
// how alike the temples are, and the scores
for (const t of report.temples) {
  const others = report.temples.filter((o) => o !== t).map((o) => ({ id: o.id, sim: L.similarity(t.skeleton, o.skeleton) }));
  const top = others.sort((a, b) => b.sim - a.sim)[0] ?? { id: null, sim: 0 };
  t.mostAlike = top;
  t.scores = L.scoreTemple(t.metrics, { maxSimilarity: top.sim });
}
report.alike = Object.fromEntries(report.temples.map((t) => [t.id, Object.fromEntries(report.temples.map((o) => [o.id, L.similarity(t.skeleton, o.skeleton)]))]));
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'views.json'), JSON.stringify({ views }, null, 2));
console.log('\nscores (1-5): structure, teach/test/twist, combination, non-obvious, decoupling, dungeon item, guardian exam, identity, curve → mean');
for (const t of report.temples) console.log(`${t.id.padEnd(10)} ${Object.values(t.scores.criteria).map((c) => c.score).join('  ')}  → ${t.scores.total}   (most alike: ${t.mostAlike.id} ${Math.round(t.mostAlike.sim * 100)} %)`);
console.log(`\nreport.json, plans and views.json in ${OUT}`);
process.exit(0);

function isUnder(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
function countBy(a) { const c = {}; for (const x of a) c[x] = (c[x] ?? 0) + 1; return c; }
function r2(v) { return Math.round(v * 100) / 100; }
function mid3(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1, (a[2] + b[2]) / 2]; }
function backOff(stand, lock, d) { const dx = stand[0] - lock[0], dz = stand[2] - lock[2], n = Math.hypot(dx, dz) || 1; return [stand[0] + dx / n * d, stand[1] + 1.2, stand[2] + dz / n * d]; }
