// Importable temple measurement; audit.mjs owns arguments, files and process exit.
// The CLI and gameplay regression tests execute this same measurement algorithm.
export async function measureTemples({ temples = null, log = () => {} } = {}) {
  // a little DOM, as the node tests have it (some pieces build a canvas for their glyphs)
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, append() {}, setAttribute() {}, set textContent(v) {}, set innerHTML(v) {}, get firstElementChild() { return el(); } });
  const ctx2d = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ctx2d()), set: (o, k, v) => { o[k] = v; return true; } });
  globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? Object.assign(el(), { width: 1, height: 1, getContext: () => ctx2d(), toDataURL: () => '' }) : el()), body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, hidden: false };

  const THREE = await import('three');
  await import('../../tests/register-gadgets.js');
  const { TEMPLES, templesIn } = await import('../../src/temples/index.js');
  const { recordTemple } = await import('./record.mjs');
  const RU = await import('./rules.mjs');
  const { solve } = await import('../../src/temples/logic.js');
  const L = await import('./lib.mjs');
  const { ORDER } = await import('../../src/levels/names.js');

  // (what each layout places, the class and the options, and the kit's rooms: record.mjs)

  // the temples in the order the route reaches them: a merged world's own first, then its part's (the Aerie, then the
  // Founders' Belfry; Lorn's Hush-House, then the Lamp-House), the Clock-House in the Glass Dunes (src/temples/index.js
  // templesIn, TEMPLE_HOME)
  const ROUTE_TEMPLES = ORDER.flatMap((w) => templesIn(w).sort((a, b) => (b === w) - (a === w)));
  // (a temple's finds: its gadget, and a second chest's item, the Givers' guard)
  const gadgetsOf = (id) => Object.values(TEMPLES[id]?.def.logic.elements ?? {}).filter((e) => (e.type === 'gadget' || e.type === 'find') && e.item).map((e) => e.item);
  // what the traveller carries in by then (the audit once solved every temple with the backpack alone, so no ball rolled,
  // no eye was shot and no tether pulled: no temple solved, and every door counted shut for the sight lines): the
  // backpack, the gun and the double jump from the desert's boxes, and each gadget of the temples before it on the route.
  // The Rose House (v1.44) is walked into with empty hands: the backpack and the double jump only (the gun is the
  // Hearth's, and the house never asks for it); the blade and the guard it holds are carried into every temple after it
  const carriedInto = (id) => {
    const k = ROUTE_TEMPLES.indexOf(id);
    return ['backpack', ...(id === 'desert' ? [] : ['doublejump', 'gun']), ...(k < 0 ? [] : ROUTE_TEMPLES.slice(0, k).flatMap(gadgetsOf))];
  };
  const ids = (temples ?? ROUTE_TEMPLES).filter((id) => TEMPLES[id]);
  const report = { date: new Date().toISOString(), temples: [] };
  const views = [];
  const plans = {};
  for (const id of ids) {
    const def = TEMPLES[id].def;
    const { rt, scene, pieces, spaces } = recordTemple(def);
    scene.updateMatrixWorld(true);
    // line of sight in the temple's own frame: its walls, floors, pieces (doors shut as at the start), not the guardian, and
    // not a pane of glass (a mesh marked `seeThrough`: the Mooring-House's windows toward its lamp-eye, issue #561)
    const solids = [];
    rt.root.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.seeThrough && !(rt.guardian && isUnder(o, rt.guardian.model?.group))) solids.push(o); });
    const ray = new THREE.Raycaster();
    const s = solve(def.logic, { items: carriedInto(id) });
    // the gates you came through to reach a lock's room stand open by then (an iris you flew up through, a door): their
    // pieces' meshes are left out of that lock's line of sight. A gate counts as come through when both rooms of its link
    // are reached no later than the lock's room.
    const at = (r) => { const i = s.order.indexOf(r); return i < 0 ? Infinity : i; };
    const meshesOf = (p) => { const out = new Set(); for (const v of Object.values(p)) if (v?.isObject3D) v.traverse((o) => { if (o.isMesh) out.add(o); }); return out; };
    const passed = new Map();
    const openBy = (link) => {
      if (!link) return null;
      if (!passed.has(link)) {
        const skip = new Set();
        for (const l of def.logic.links) if (l.door && l !== link && Math.max(at(l.a), at(l.b)) <= at(link.a)) for (const p of rt.pieces) if (p.id === l.door) for (const m of meshesOf(p)) skip.add(m);
        passed.set(link, solids.filter((m) => !skip.has(m)));
      }
      return passed.get(link);
    };
    // (the key looked at is left out too: its own piece, an eye's lids round it, never hides it, v1.74)
    const own = new Map();
    const ownOf = (id) => { if (!own.has(id)) { const s = new Set(); for (const p of rt.pieces) if (p.id === id) for (const m of meshesOf(p)) s.add(m); own.set(id, s); } return own.get(id); };
    const los = (a, b, link, key = null) => {
      const A = rt.kit.world(...a), B = rt.kit.world(...b), d = A.distanceTo(B);
      if (d < 0.5) return true;
      ray.set(A, B.clone().sub(A).normalize()); ray.far = d - 1.2;
      const skip = key ? ownOf(key) : null;
      return ray.intersectObjects(openBy(link) ?? solids, false).filter((h) => !skip?.has(h.object)).length === 0;
    };
    const g = L.puzzleGraph(def.logic, pieces, { los, order: s.order });
    const guardian = rt.guardian?.def ?? null;
    const m = L.templeMetrics(g, { guardian });
    // the redesign's rules (issue #336, docs/design/temple-redesign.md): room and door sizes, puzzles centred, one kind a room
    const centre = rt.guardian?.arena?.center ? rt.kit.local(rt.guardian.arena.center).toArray() : null;
    const rules = RU.templeRules({ logic: def.logic, pieces, spaces, order: s.order, guardian: centre ? { center: centre } : null, encounter: def.encounter ?? null });
    report.temples.push({ id, name: def.name, solved: s.done, carried: carriedInto(id), skeleton: L.skeleton(g), graph: { rooms: g.rooms, order: g.roomOrder, chestRoom: g.chestRoom, locks: g.locks.map((l) => ({ id: l.id, a: l.a, b: l.b, type: l.type, mechanics: l.mechanics, keys: l.keys.map((k) => ({ id: k.id, how: k.how, room: k.room, metres: k.metres, rooms: k.rooms, visible: k.visible, mech: k.mech })), arena: l.arena, bossDoor: l.bossDoor })), traversal: g.traversal, pieces: countBy(pieces.map((p) => p.cls)) }, metrics: m, rules });
    plans[id] = L.planSvg(g, m, { title: `${def.name} (${id}): ${L.skeleton(g)}` });
    // the two most obvious steps, seen from where you stand to face the lock, looking at the key
    for (const st of [...m.steps].sort((a, b) => b.obvious - a.obvious).slice(0, 2)) {
      const lock = g.locks.find((l) => l.id === st.lock);
      const key = lock?.keys.find((k) => k.pos);
      if (!lock?.stand || !lock.pos) continue;
      const eye = rt.kit.world(...backOff(lock.stand, lock.pos, 4)), look = rt.kit.world(...(key ? mid3(lock.pos, key.clue ?? key.pos) : lock.pos));
      views.push({ world: id, name: `temple-${id}-${st.lock}`, eye: eye.toArray().map(r2), target: look.toArray().map(r2), player: rt.kit.world(...lock.stand).sub(new THREE.Vector3(0, 1.7, 0)).toArray().map(r2), hour: 12, fov: 70, note: `${st.lock}: obviousness ${st.obvious} (${st.why.join('; ') || 'key beside the lock, in sight, one verb'})` });
    }
    rt.dispose?.();
    log(`${id.padEnd(10)} ${L.skeleton(g).padEnd(10)} steps ${m.steps.length}, combos ${m.combos}, obviousness ${m.obviousness.mean}, decoupled ${m.decoupled}, loops ${m.structure.cycles}, gadget ${m.gadget.uses}× (${m.gadget.contexts.join('/')}), guardian ${m.guardian.usesGadget ? 'asks the gadget' : 'no gadget'}`);
  }
  // how alike the temples are, and the scores
  for (const t of report.temples) {
    const others = report.temples.filter((o) => o !== t).map((o) => ({ id: o.id, sim: L.similarity(t.skeleton, o.skeleton) }));
    const top = others.sort((a, b) => b.sim - a.sim)[0] ?? { id: null, sim: 0 };
    t.mostAlike = top;
    t.scores = L.scoreTemple(t.metrics, { maxSimilarity: top.sim });
  }
  report.alike = Object.fromEntries(report.temples.map((t) => [t.id, Object.fromEntries(report.temples.map((o) => [o.id, L.similarity(t.skeleton, o.skeleton)]))]));
  return { report, views, plans };
}

function isUnder(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
function countBy(a) { const c = {}; for (const x of a) c[x] = (c[x] ?? 0) + 1; return c; }
function r2(v) { return Math.round(v * 100) / 100; }
function mid3(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1, (a[2] + b[2]) / 2]; }
function backOff(stand, lock, d) { const dx = stand[0] - lock[0], dz = stand[2] - lock[2], n = Math.hypot(dx, dz) || 1; return [stand[0] + dx / n * d, stand[1] + 1.2, stand[2] + dz / n * d]; }
