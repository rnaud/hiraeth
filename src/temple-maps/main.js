// The temple maps (issue #396; docs/systems/dev-tools.md "The temple maps"): every makers' temple and every fight temple
// as a map to review: its plan per floor, its flow (the lock-and-key graph), its solution as numbered steps drawn over
// the plan, and its numbers. One temple at a time (?t=<id>, a fight temple's run ?seed=<n>; ?step=<n>, ?floor=<id>,
// ?view=plan|graph|three keep the place). The maps come from the temples' own data and solver: makers.js, fights.js.
// Each temple and each step has an id ("moonfoundry-3"): click it to copy it, for a comment.
//
// The save is sandboxed first: the temples' logic reads and writes flags, never to the player's slots.
import { slots } from '../save-slots.js';
slots.sandbox();

const THREE = await import('three');
const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
await import('../gadgets/all.js');   // (the gadgets become items before anything reads ITEMS: as main.js)
const { TEMPLES } = await import('../temples/index.js');
const { MAKERS, makersMap, verbWord } = await import('./makers.js');
const { buildTemple } = await import('./record.js');
const { FIGHTS, fightMap } = await import('./fights.js');
const { seedOf } = await import('../fight-temples/generate.js');

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const q = new URLSearchParams(location.search);
const LIST = [...MAKERS.map((id) => ({ id, name: TEMPLES[id].def.name, kind: 'makers' })), ...FIGHTS.map((d) => ({ id: d.id, name: d.name, kind: 'fight', def: d }))];
const pick = LIST.find((t) => t.id === q.get('t')) ?? LIST[0];
const S = { view: ['plan', 'graph', 'three'].includes(q.get('view')) ? q.get('view') : 'plan', floor: q.get('floor') ?? 'all', step: Math.max(0, Number(q.get('step')) || 0), hover: null };
const save = () => {
  const p = new URLSearchParams();
  p.set('t', pick.id);
  if (M?.seed) p.set('seed', M.seed);
  if (S.step) p.set('step', S.step);
  if (S.floor !== 'all') p.set('floor', S.floor);
  if (S.view !== 'plan') p.set('view', S.view);
  history.replaceState(null, '', `?${p}`);
};

// ---- the header
$('#temple').innerHTML = [['makers', 'Makers’ temples'], ['fight', 'Fight temples']].map(([k, label]) => `<optgroup label="${label}">${LIST.filter((t) => t.kind === k).map((t) => `<option value="${t.id}"${t.id === pick.id ? ' selected' : ''}>${esc(t.name)} · ${t.id}</option>`).join('')}</optgroup>`).join('');
$('#temple').addEventListener('change', (e) => { location.search = `?t=${e.target.value}`; });
document.title = `Hiraeth — temple map: ${pick.name}`;
if (pick.kind === 'fight') {
  $('#seedBox').hidden = false;
  $('#reseed').addEventListener('click', () => { location.search = `?t=${pick.id}&seed=${1 + Math.floor(Math.random() * 999999)}`; });
  $('#seed').addEventListener('change', (e) => { const s = Math.floor(Number(e.target.value)); if (s > 0) location.search = `?t=${pick.id}&seed=${s}`; });
  $('#views [data-view=three]').disabled = true;
  $('#views [data-view=three]').title = 'The plan is the fight temple’s map (its rooms are flat rectangles)';
  if (S.view === 'three') S.view = 'plan';
}

if (innerWidth < 820) $('#legend').open = false;   // (a phone: the key folded away, the map first)

// ---- build
await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // (the "building" card drawn first)
let M = null, B = null;
const scene3 = new THREE.Scene();
try {
  if (pick.kind === 'makers') { B = buildTemple(TEMPLES[pick.id].def, { scene: scene3 }); M = makersMap(pick.id, { built: B }); }
  else M = fightMap(pick.def, seedOf(location.search));
} catch (e) { $('#busy').textContent = `could not build ${pick.id}: ${e.message}`; throw e; }
$('#busy').hidden = true;
if (M.seed) $('#seed').value = M.seed;
const STEPS = M.steps;
S.step = Math.min(S.step, STEPS.length);
if (S.floor !== 'all' && !M.floors.some((f) => f.id === S.floor)) S.floor = 'all';
const floorName = (id) => M.floors.find((f) => f.id === id)?.name ?? id;
const roomOf = Object.fromEntries(M.rooms.map((r) => [r.id, r]));
const rname = (id) => roomOf[id]?.name ?? id;
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1400); };
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-copy]');
  if (!r) return;
  e.stopPropagation();
  navigator.clipboard?.writeText(r.dataset.copy).then(() => toast(`copied ${r.dataset.copy}`), () => toast(r.dataset.copy));
});

// ---- the bar under the header: what this temple is, the floors
function sub() {
  const bits = [`<span class="id" data-copy="${M.id}" title="Click to copy the temple's id">${esc(M.id)}</span>`, `<b>${esc(M.name)}</b>`];
  if (M.kind === 'makers') {
    if (M.gadget) bits.push(`dungeon item: <b>${esc(M.gadget.name)}</b> <span class="muted">in “${esc(rname(M.gadget.room))}”</span>`);
    if (M.guardian) bits.push(`guardian: <b>${esc(M.guardian.name)}</b>`);
    bits.push(`<span class="muted carried">carried in: ${esc(M.carried.filter((x) => x !== 'backpack').join(', '))}</span>`);
  } else {
    bits.push(`run <b data-copy="?t=${M.id}&seed=${M.seed}">${M.seed}</b> <span class="muted">(rooms drawn: ${esc(M.order.join(' → '))})</span>`);
    if (M.metrics.hazard) bits.push(`hazard: <b>${esc(M.metrics.hazard)}</b>`);
  }
  const floors = M.floors.length > 1 ? `<span class="seg" role="group" aria-label="Floor">${[{ id: 'all', name: 'all floors' }, ...M.floors].map((f) => `<button data-floor="${f.id}" aria-pressed="${S.floor === f.id}">${esc(f.name)}</button>`).join('')}</span>` : '';
  $('#sub').innerHTML = bits.join(' · ') + (floors ? ` <span class="gap"></span> ${floors}` : '');
  for (const b of $('#sub').querySelectorAll('[data-floor]')) b.addEventListener('click', () => { S.floor = b.dataset.floor; refresh(); });
}

// ---- the solution panel
const verbTags = (vs) => vs.map((v) => `<span class="tag">${esc(verbWord(v))}</span>`).join('');
function stepMeta(s) {
  const out = [`“${esc(rname(s.room))}”`];
  if (M.floors.length > 1 && s.floor) out.push(esc(floorName(s.floor)));
  if (s.metres) out.push(`walk ${Math.round(s.metres)} m`);
  if (s.through?.length) out.push(`through ${s.through.map((l) => esc(linkName(l))).join(', ')}`);
  if (s.opens?.length) out.push(`<b>opens ${s.opens.map(esc).join(', ')}</b>`);
  for (const k of s.serves ?? []) out.push(`its lock <b>${esc(k.lock)}</b>${Number.isFinite(k.metres) ? ` ${Math.round(k.metres)} m away` : ''}${k.rooms ? `, ${k.rooms} room${k.rooms > 1 ? 's' : ''} off` : ''}${k.visible ? ', in sight' : ', <span class="tag hidden">out of sight</span>'}`);
  for (const c of s.clue ?? []) out.push(`clue <b>${esc(c.id)}</b> in “${esc(rname(c.room))}”, ${Math.round(c.metres)} m from the lock${c.visible ? '' : ', <span class="tag hidden">out of sight</span>'}`);
  if (s.why) out.push(esc(s.why));
  return out.join(' · ');
}
function linkName(id) { const l = M.links.find((x) => x.id === id); return l ? (l.door ?? `${l.a}–${l.b}`) : id; }
function solution() {
  const list = (steps, extra) => steps.map((s, i) => `<li data-i="${extra ? '' : i + 1}" data-room="${esc(s.room)}" class="${extra ? 'extra' : ''}${!extra && S.step === i + 1 ? ' on' : ''}${!extra && S.step && i + 1 < S.step ? ' done' : ''}">
      <span class="n">${s.n}</span><span class="ref" data-copy="${esc(s.id)}" title="Click to copy the step's id">${esc(s.id)}</span> ${esc(s.text)}
      <div class="meta">${stepMeta(s)}</div><div>${verbTags(s.verbs)}</div></li>`).join('');
  $('#solution').innerHTML = `<h2>The solution <span class="gap"></span><span id="nav"><button id="prev" title="Previous step (←)">◀</button><span>${S.step ? `step ${S.step} / ${STEPS.length}` : `${STEPS.length} steps`}</span><button id="next" title="Next step (→)">▶</button></span></h2>
    <p class="muted" style="margin:0 0 6px;font-size:12px">${M.kind === 'makers' ? 'Solved by the temples’ own solver (logic.js solve), with what the route has given by then. The walk goes through the doors open at that moment.' : 'A fight temple has no puzzle: each gate sinks once its room’s waves are cleared. The waves are this run’s.'} ◀ ▶ or the arrow keys step through; click a step to show it.</p>
    <ol class="steps">${list(STEPS, false)}</ol>
    ${M.extras?.length ? `<h2 style="margin-top:10px">Extras: nothing waits on these</h2><ol class="steps">${list(M.extras, true)}</ol>` : ''}`;
  $('#prev').addEventListener('click', () => go(S.step - 1));
  $('#next').addEventListener('click', () => go(S.step + 1));
  for (const li of $('#solution').querySelectorAll('li')) {
    li.addEventListener('click', () => { if (li.dataset.i) go(Number(li.dataset.i) === S.step ? 0 : Number(li.dataset.i)); });
    li.addEventListener('mouseenter', () => { S.hover = li.dataset.room; draw(); });
    li.addEventListener('mouseleave', () => { S.hover = null; draw(); });
  }
  // (the step looked at kept in view in the side panel; on a phone the panel is the page, left where it is)
  const li = $('#solution li.on'), aside = $('aside');
  if (li && aside.scrollHeight > aside.clientHeight + 4) aside.scrollTop = Math.max(0, li.offsetTop - aside.clientHeight / 3);
}
function go(n) {
  S.step = Math.max(0, Math.min(STEPS.length, n));
  const st = STEPS[S.step - 1];
  if (st && S.floor !== 'all' && st.floor && st.floor !== S.floor) S.floor = st.floor;
  refresh();
}
addEventListener('keydown', (e) => {
  if (e.target.closest('input, select')) return;
  if (e.key === 'ArrowRight') { go(S.step + 1); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { go(S.step - 1); e.preventDefault(); }
});

// ---- the numbers panel
function numbers() {
  const m = M.metrics, rows = [
    ['Rooms', m.rooms], ['Floors', m.floors],
    ...(M.kind === 'makers' ? [['Keys found / locked doors', `${m.keys} / ${m.locks}`], ['Puzzles (doors and cages with a condition)', m.puzzles]] : [['Gates (each its room cleared)', m.locks], ['Waves / foes', `${m.waves} / ${m.foes}`]]),
    ['Steps to solve', m.steps + (m.optional ? ` <span class="muted">(+${m.optional} extras)</span>` : '')],
    ['Walked on the solution path', `${m.walked} m`],
    ['Furthest clue from its lock', m.furthestClue ? `${Math.round(m.furthestClue.metres)} m <span class="muted">(${esc(m.furthestClue.key)} → ${esc(m.furthestClue.lock)}${m.furthestClue.rooms ? `, ${m.furthestClue.rooms} room${m.furthestClue.rooms > 1 ? 's' : ''} off` : ''})</span>` : '<span class="muted">none: no clue away from its lock</span>'],
    ['Times the path goes back into a room it had left', m.backtracks],
  ];
  const verbs = Object.entries(m.verbs).sort((a, b) => b[1] - a[1]).map(([v, n]) => `<span class="tag">${esc(verbWord(v))} ×${n}</span>`).join(' ');
  $('#numbers').innerHTML = `<h2>${esc(M.name)} in numbers</h2><table class="nums">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <p style="margin:6px 0 0"><span class="muted">Verbs the steps use:</span><br>${verbs}</p>${m.solved ? '' : '<p style="color:var(--hot)"><b>The solver could not finish this temple.</b></p>'}`;
}

// ------------------------------------------------------------------ the SVG stage: the plan and the graph, panned and zoomed
const svg = $('#svg');
const NS = 'http://www.w3.org/2000/svg';
const VB = { plan: null, graph: null };
let content = null;   // { x, y, w, h } of what is drawn, for fit
const vbSet = () => { const v = VB[S.view]; if (v) svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };
function fit() {
  if (!content) return;
  const r = svg.getBoundingClientRect(), pad = 0.06;
  const w = content.w * (1 + 2 * pad), h = content.h * (1 + 2 * pad), aspect = r.width / Math.max(1, r.height);
  // (the graph: as wide as the stage, read from the top down, panned for the rest; the plan: all of it)
  const W = content.top ? Math.max(w, r.width / 1.1) : Math.max(w, h * aspect), H = W / aspect;
  const y = content.top && H < h ? content.y - content.h * pad : content.y + content.h / 2 - H / 2;
  VB[S.view] = { x: content.x + content.w / 2 - W / 2, y, w: W, h: H };
  vbSet();
}
function zoom(k, cx = 0.5, cy = 0.5) {
  const v = VB[S.view]; if (!v) return;
  const nw = v.w * k, nh = v.h * k;
  v.x += (v.w - nw) * cx; v.y += (v.h - nh) * cy; v.w = nw; v.h = nh; vbSet();
}
$('#zin').addEventListener('click', () => zoom(0.75));
$('#zout').addEventListener('click', () => zoom(1 / 0.75));
$('#zfit').addEventListener('click', fit);
svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoom(Math.exp(e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
const pts = new Map();
let pinch = null;
svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = null; });
svg.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  const v = VB[S.view], r = svg.getBoundingClientRect();
  const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { v.x -= (e.clientX - px) * v.w / r.width; v.y -= (e.clientY - py) * v.h / r.height; vbSet(); }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) zoom(pinch / d, ((a[0] + b[0]) / 2 - r.left) / r.width, ((a[1] + b[1]) / 2 - r.top) / r.height);
    pinch = d;
  }
});
const up = (e) => { pts.delete(e.pointerId); pinch = null; };
svg.addEventListener('pointerup', up);
svg.addEventListener('pointercancel', up);

// ---- drawing helpers
const el = (tag, a = {}, text) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) if (v != null) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
const COL = { gate: '#2b211f', floor: '#fbf3dc', floor2: '#efe1bf', wall: '#4a3a33', stairs: '#c9a46b', lift: '#2e8a48', updraft: '#3aa3b8', door: '#2b211f', locked: '#b07a00', great: '#b07a00', bridge: '#8a5a3c', needs: '#7b4fd0', oneway: '#7b4fd0', boss: '#d0312d', arena: '#d0312d', held: '#c2410c', open: '#8a7a68', path: '#2f6fd6', hot: '#d0312d' };
/** Each floor's colour in the plan, the lowest first (so a gallery over a hall reads as another level). */
const FLOOR_TINT = ['#efe1bf', '#d8e3ea', '#e5dbef', '#dbe9d6', '#f0d9cb', '#e2e2e2'];
const LOCKS = ['#b07a00', '#7b4fd0', '#0f9d8a', '#c2410c', '#2f6fd6', '#a0306f', '#5a7d1a', '#8a5a3c'];
const SYM = { drum: '●', plate: '■', switch: '◆', brazier: '▲', bramble: '✶', bell: '◉', vane: '✳', key: 'k', gadget: '▣', find: '▣', cache: '▣', weight: '■', arena: '⚔', boss: '★', waves: '⚔', reward: '▣' };
const P = (p) => [p[0], -p[2]];   // (plan: x right, z up the screen: the way in at the bottom)

function legend() {
  const rows = S.view === 'plan' && M.kind === 'fight'
    ? [['fill', COL.floor, 'a room'], ['wall', COL.wall, 'walls; the dark bars are the gates'], ['dot', '#8a8399', 'an ink spring: where the foes come up'], ['dot', COL.wall, 'a pillar'], ['dash', COL.hot, 'a hazard lane, or its sign (red) or lamp (yellow)'], ['fill', '#e8703a', 'the altar and its reliquary'], ['badge', COL.path, 'a step of the solution'], ['path', COL.path, 'the walk between steps']]
    : S.view === 'graph'
    ? [['line', COL.open, 'open way'], ['line', COL.door, 'door (opens on a condition)'], ['line', COL.locked, 'locked: a key goes in'], ['dash', COL.needs, 'only an item makes it (a glide, the jets)'], ['arrow', COL.oneway, 'one way (a drop)'], ['line', COL.boss, 'the guardian’s doors'], ['key', LOCKS[0], 'a key or clue → the lock it opens'], ['node', COL.path, 'room on the current step']]
    : [['fill', FLOOR_TINT[0], 'floor (each level its own colour)'], ['wall', COL.wall, 'walls (gaps are doorways)'], ['fill', COL.stairs, 'stairs, ramps, bridges'], ['lift', COL.lift, 'a lift or a wind up'], ['badge', COL.path, 'a step of the solution'], ['path', COL.path, 'the walk between steps'], ['mark', COL.locked, 'K small lock · G great lock · D door · B guardian']];
  const icon = ([k, c]) => {
    if (k === 'fill') return `<rect x="2" y="2" width="22" height="10" fill="${c}" stroke="#0003"/>`;
    if (k === 'wall') return `<rect x="2" y="5" width="22" height="4" fill="${c}"/>`;
    if (k === 'lift') return `<circle cx="13" cy="7" r="5" fill="none" stroke="${c}" stroke-width="2"/>`;
    if (k === 'badge') return `<circle cx="13" cy="7" r="6" fill="${c}"/><text x="13" y="10" font-size="8" fill="#fff" text-anchor="middle">3</text>`;
    if (k === 'path' || k === 'line') return `<line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-width="2.5"/>`;
    if (k === 'dash') return `<line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-width="2.5" stroke-dasharray="4 3"/>`;
    if (k === 'arrow') return `<line x1="2" y1="7" x2="20" y2="7" stroke="${c}" stroke-width="2.5"/><path d="M18 3 L25 7 L18 11Z" fill="${c}"/>`;
    if (k === 'key') return `<path d="M2 7 Q13 0 22 7" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M19 4 L24 8 L18 9Z" fill="${c}"/>`;
    if (k === 'dot') return `<circle cx="13" cy="7" r="5" fill="${c}"/>`;
    if (k === 'node') return `<rect x="2" y="2" width="22" height="10" rx="2" fill="#fff" stroke="${c}" stroke-width="2.5"/>`;
    if (k === 'mark') return `<circle cx="13" cy="7" r="6" fill="#fff" stroke="${c}" stroke-width="1.5"/><text x="13" y="10" font-size="8" text-anchor="middle">K</text>`;
    return '';
  };
  $('#legend .body').innerHTML = rows.map((r) => `<div class="row"><svg viewBox="0 0 26 14">${icon(r)}</svg>${r[2]}</div>`).join('');
}

// ------------------------------------------------------------------ the plan
function plan() {
  const g = el('g');
  const B0 = M.plan.bounds, span = Math.max(B0[2] - B0[0], B0[3] - B0[1]);
  const fs = Math.max(1.6, span / 70);   // (labels: metres, from the temple's size)
  const on = (f, to) => S.floor === 'all' || f === S.floor || (to && to === S.floor);
  const dimIf = (f, to) => (on(f, to) ? null : 'dim');
  const shapes = M.plan.shapes;
  // floors first, then walls, then the ways up, then doors, rooms, pieces, the path, the badges
  const gD = el('g'), gR = el('g'), gE = el('g'), gP = el('g'), gB = el('g');
  // each floor its own layer (floors, walls, the ways up), the lowest first, the one looked at on top
  const fIdx = (f) => M.floors.findIndex((x) => x.id === f);
  const layers = M.floors.map((f) => ({ f, F: el('g'), W: el('g'), U: el('g') }));
  const tint = (f) => FLOOR_TINT[Math.max(0, fIdx(f)) % FLOOR_TINT.length];
  for (const s of shapes) {
    const c = dimIf(s.floor, s.to), L = layers[Math.max(0, fIdx(s.floor))], gF = L.F, gW = L.W, gU = L.U;
    if (s.kind === 'hall' && s.hasFloor) gF.append(el('rect', { x: s.x - s.w / 2, y: -(s.z + s.d / 2), width: s.w, height: s.d, fill: tint(s.floor), class: c }));
    else if (s.kind === 'round') {
      const R = s.r + (s.t ?? 1.4) / 2;
      if (s.hasFloor && s.oculus >= 0) gF.append(el('circle', { cx: s.x, cy: -s.z, r: R, fill: tint(s.floor), class: c }));
      // its wall round, the doorways (gaps from the floor) left open
      const N = 96, open = (a) => (s.gaps ?? []).some((q) => (q.y0 ?? 0) < 2.5 && Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a))) * R < q.w / 2);
      let run = [];
      const flush = () => { if (run.length > 1) gW.append(el('polyline', { points: run.map((q) => q.join(',')).join(' '), fill: 'none', stroke: COL.wall, 'stroke-width': Math.max(0.6, s.t ?? 1.4), class: c })); run = []; };
      for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; if (open(a)) flush(); else run.push([s.x + Math.sin(a) * R, -(s.z + Math.cos(a) * R)]); }
      flush();
    }
    else if (s.kind === 'corridor' || s.kind === 'slab') gF.append(el('rect', { x: s.x0, y: -s.z1, width: s.x1 - s.x0, height: s.z1 - s.z0, fill: s.room ? COL.floor : tint(s.floor), stroke: s.room ? '#0002' : null, 'stroke-width': 0.2, class: c }));
    else if (s.kind === 'box') gW.append(el('rect', { x: s.x0, y: -s.z1, width: s.x1 - s.x0, height: s.z1 - s.z0, fill: COL.wall, class: c }));
    else if (s.kind === 'wall') {
      // the wall's run, the doorways (holes reaching the floor) left open; a window or a high door drawn thin
      const [ax, az] = s.a, [dx, dz] = s.dir, cut = s.holes.filter((h) => h.y0 < 2.5).sort((a, b) => a.x0 - b.x0);
      let from = 0;
      const seg = (u0, u1) => { if (u1 - u0 > 0.05) gW.append(el('line', { x1: ax + dx * u0, y1: -(az + dz * u0), x2: ax + dx * u1, y2: -(az + dz * u1), stroke: COL.wall, 'stroke-width': Math.max(0.6, s.t), class: c })); };
      for (const h of cut) { seg(from, Math.max(from, h.x0)); from = Math.max(from, h.x1); }
      seg(from, s.L);
      for (const h of s.holes.filter((x) => x.y0 >= 2.5)) gW.append(el('line', { x1: ax + dx * h.x0, y1: -(az + dz * h.x0), x2: ax + dx * h.x1, y2: -(az + dz * h.x1), stroke: '#fbf3dc', 'stroke-width': Math.max(0.2, s.t * 0.4), class: c }));
    } else if (s.kind === 'shaft') gU.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: 'none', stroke: COL.wall, 'stroke-width': 0.6, 'stroke-dasharray': '1.2 1', class: c }));
    else if (s.kind === 'stairs' || s.kind === 'ramp' || s.kind === 'bridge') {
      const [x1, y1] = P(s.a), [x2, y2] = P(s.b), L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L, w = s.w / 2;
      gU.append(el('polygon', { points: [[x1 + nx * w, y1 + ny * w], [x2 + nx * w, y2 + ny * w], [x2 - nx * w, y2 - ny * w], [x1 - nx * w, y1 - ny * w]].map((p) => p.join(',')).join(' '), fill: s.kind === 'bridge' ? '#d9c39a' : COL.stairs, stroke: '#0004', 'stroke-width': 0.2, class: c }));
      if (s.kind === 'stairs') { const n = Math.min(24, Math.max(3, Math.round(L / 0.9))); for (let i = 1; i < n; i++) { const k = i / n, cx = x1 + (x2 - x1) * k, cy = y1 + (y2 - y1) * k; gU.append(el('line', { x1: cx + nx * w, y1: cy + ny * w, x2: cx - nx * w, y2: cy - ny * w, stroke: '#0003', 'stroke-width': 0.15, class: c })); } }
      // (up the way it rises)
      const hi = s.b[1] >= s.a[1] ? [x2, y2] : [x1, y1], lo = s.b[1] >= s.a[1] ? [x1, y1] : [x2, y2];
      if (Math.abs(s.b[1] - s.a[1]) > 0.5) gU.append(el('line', { x1: lo[0], y1: lo[1], x2: hi[0] - (hi[0] - lo[0]) * 0.12, y2: hi[1] - (hi[1] - lo[1]) * 0.12, stroke: '#5a3a22', 'stroke-width': 0.35, 'marker-end': 'url(#up)', class: c }));
    } else if (s.kind === 'lift') {
      const p = s.path.map(P);
      gU.append(el('polyline', { points: p.map((q) => q.join(',')).join(' '), fill: 'none', stroke: COL.lift, 'stroke-width': 0.5, 'stroke-dasharray': '1.5 1', class: c }));
      for (const q of [p[0], p.at(-1)]) if (q) gU.append(el('circle', { cx: q[0], cy: q[1], r: s.r, fill: 'none', stroke: COL.lift, 'stroke-width': 0.5, class: c }));
      if (p[0]) gU.append(el('text', { x: p[0][0], y: p[0][1] + s.r + fs, 'font-size': fs * 0.8, fill: COL.lift, 'text-anchor': 'middle', class: c }, `lift${s.id ? ` ${s.id}` : ''}`));
    } else if (s.kind === 'updraft') {
      gU.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: 'rgba(58,163,184,0.12)', stroke: COL.updraft, 'stroke-width': 0.4, class: c }));
      gU.append(el('text', { x: s.x, y: -s.z + fs * 0.35, 'font-size': fs * 0.8, fill: COL.updraft, 'text-anchor': 'middle', class: c }, `wind up ${Math.round(s.top - s.y)} m`));
    } else if (s.kind === 'pillar') gW.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: COL.wall, class: c }));
    else if (s.kind === 'spring') gE.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: '#2a2440', opacity: 0.55, class: c }));
    else if (s.kind === 'basin') gF.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: '#2a244055', class: c }));
    else if (s.kind === 'altar') gE.append(el('rect', { x: s.x - s.r, y: -s.z - s.r, width: 2 * s.r, height: 2 * s.r, fill: '#e8703a', stroke: COL.wall, 'stroke-width': 0.2, class: c }));
    else if (s.kind === 'lane') gF.append(el('rect', { x: s.x0, y: -s.z1, width: s.x1 - s.x0, height: s.z1 - s.z0, fill: 'rgba(208,49,45,0.14)', stroke: 'rgba(208,49,45,0.5)', 'stroke-width': 0.15, 'stroke-dasharray': '0.6 0.4', class: c }));
    else if (s.kind === 'sign' || s.kind === 'lamp') gE.append(el('circle', { cx: s.x, cy: -s.z, r: s.r, fill: s.kind === 'lamp' ? '#ffd76a' : '#d0312d', stroke: COL.wall, 'stroke-width': 0.15, class: c }));
    else if (s.kind === 'gate') gD.append(el('rect', { x: s.x0, y: -s.z1, width: s.x1 - s.x0, height: s.z1 - s.z0, fill: COL.door, opacity: 0.8, class: c }));
  }
  // the doors and the ways between rooms, marked where they are
  const mark = { door: 'D', locked: 'K', great: 'G', bridge: '=', boss: 'B', arena: '⚔', held: '✶', needs: '↗', oneway: '↓' };
  const curLinks = new Set(STEPS[S.step - 1]?.through ?? []), curOpens = new Set(STEPS[S.step - 1]?.opens ?? []);
  for (const l of M.links) {
    if (!l.way || !mark[l.type] || M.kind === 'fight') continue;
    const [x, y] = P(l.way), c = dimIf(l.floor);
    const hot = curOpens.has(l.door) || curLinks.has(l.id);
    const gg = el('g', { class: c });
    gg.append(el('title', {}, `${l.door ?? l.id}: ${l.label} (${rname(l.a)} – ${rname(l.b)})`));
    gg.append(el('circle', { cx: x, cy: y, r: fs * 0.75, fill: hot ? '#fff2a8' : '#fff', stroke: COL[l.type] ?? COL.door, 'stroke-width': fs * 0.16 }));
    gg.append(el('text', { x, y: y + fs * 0.32, 'font-size': fs * 0.85, 'text-anchor': 'middle', 'font-weight': 700, fill: COL[l.type] ?? COL.door }, mark[l.type]));
    gg.append(el('text', { x: x + fs * 0.95, y: y - fs * 0.5, 'font-size': fs * 0.62, fill: '#5a4a3a' }, l.door ?? ''));
    gD.append(gg);
  }
  // the pieces
  for (const e of M.elements) {
    if (!e.pos) continue;
    const [x, y] = P(e.pos), c = dimIf(e.floor);
    const gg = el('g', { class: c });
    gg.append(el('title', {}, `${e.id}: ${e.noun} (${e.verbs.map(verbWord).join(', ')})${e.hidden ? ' · hidden until revealed' : ''}`));
    gg.append(el('text', { x, y: y + fs * 0.3, 'font-size': fs * 0.9, 'text-anchor': 'middle', fill: e.type === 'boss' ? COL.boss : e.type === 'key' ? COL.locked : '#5a3a22' }, SYM[e.type] ?? '·'));
    gg.append(el('text', { x: x + fs * 0.6, y: y + fs * 0.85, 'font-size': fs * 0.55, fill: '#7a5238' }, e.id));
    gE.append(gg);
  }
  // the rooms' names
  const curRoom = STEPS[S.step - 1]?.room;
  for (const r of M.rooms) {
    const [x, y] = P(r.pos), c = dimIf(r.floor);
    const hot = r.id === curRoom || r.id === S.hover;
    const gg = el('g', { class: c });
    if (hot) gg.append(el('circle', { cx: x, cy: y, r: fs * 4, fill: 'rgba(47,111,214,0.13)', stroke: COL.path, 'stroke-width': fs * 0.12 }));
    gg.append(el('text', { x, y: y - fs * 1.2, 'font-size': fs * 1.05, 'text-anchor': 'middle', 'font-weight': 700, fill: '#2b211f', stroke: '#fbf3dc', 'stroke-width': fs * 0.25, 'paint-order': 'stroke' }, r.name));
    gg.append(el('text', { x, y: y - fs * 0.35, 'font-size': fs * 0.6, 'text-anchor': 'middle', fill: '#7a5238', stroke: '#fbf3dc', 'stroke-width': fs * 0.2, 'paint-order': 'stroke' }, `${r.id}${r.entry ? ' · way in' : ''}${r.boss ? ' · guardian' : ''}`));
    gR.append(gg);
  }
  // the solution: the walk, then a numbered badge per step (several at one spot side by side)
  const seen = new Map();
  STEPS.forEach((s, i) => {
    const n = i + 1, past = !S.step || n < S.step, cur = n === S.step;
    const pathOn = on(s.floor) || on(STEPS[i - 1]?.floor ?? M.rooms.find((r) => r.entry)?.floor);
    if (s.path?.length > 1) gP.append(el('polyline', { class: pathOn ? null : 'dim', points: s.path.map((p) => P(p).join(',')).join(' '), fill: 'none', stroke: cur ? COL.hot : COL.path, 'stroke-width': cur ? fs * 0.32 : fs * 0.16, 'stroke-linejoin': 'round', 'stroke-dasharray': past || cur ? null : `${fs * 0.4} ${fs * 0.4}`, opacity: cur ? 1 : past ? 0.75 : 0.28, 'marker-end': cur ? 'url(#head)' : null }));
    const [x, y] = P(s.pos), key = `${Math.round(x / fs)},${Math.round(y / fs)}`, k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    const bx = x + k * fs * 1.5, by = y, c = on(s.floor) ? null : 'dim';
    const gg = el('g', { class: c, style: 'cursor:pointer', 'data-step': n });
    gg.append(el('title', {}, `${s.id}: ${s.text}`));
    gg.append(el('circle', { cx: bx, cy: by, r: fs * (cur ? 0.95 : 0.75), fill: cur ? COL.hot : COL.path, opacity: past || cur ? 1 : 0.45, stroke: '#fff', 'stroke-width': fs * 0.12 }));
    gg.append(el('text', { x: bx, y: by + fs * 0.3, 'font-size': fs * (cur ? 0.95 : 0.8), 'text-anchor': 'middle', fill: '#fff', 'font-weight': 700 }, n));
    gB.append(gg);
  });
  const sel = layers.find((L) => L.f.id === S.floor);
  for (const L of [...layers.filter((x) => x !== sel), ...(sel ? [sel] : [])]) g.append(L.F, L.W, L.U);
  g.append(gD, gR, gE, gP, gB);
  gB.addEventListener('click', (e) => { const t = e.target.closest('[data-step]'); if (t) go(Number(t.dataset.step)); });
  return { g, box: { x: B0[0], y: -B0[3], w: B0[2] - B0[0], h: B0[3] - B0[1] } };
}

// ------------------------------------------------------------------ the flow graph
function graph() {
  const g = el('g');
  // rows: the rooms by stage (how many steps that opened rooms came before each could be reached), top to bottom; in a
  // row, by hops from the way in
  const entry = M.rooms.find((r) => r.entry)?.id ?? M.rooms[0].id;
  const hop = { [entry]: 0 }, todo = [entry];
  while (todo.length) { const r = todo.shift(); for (const l of M.links) { const o = l.a === r ? l.b : l.b === r ? l.a : null; if (o && hop[o] == null) { hop[o] = hop[r] + 1; todo.push(o); } } }
  const stages = [];
  for (const r of [...M.rooms].sort((a, b) => (hop[a.id] ?? 99) - (hop[b.id] ?? 99))) (stages[r.stage ?? 0] ??= []).push(r);
  // (a narrow screen: two rooms a row at most, a stage wrapping onto more rows)
  const narrow = svg.getBoundingClientRect().width < 600, cols = narrow ? 2 : 5;
  const rowsIn = stages.filter(Boolean).flatMap((rs) => Array.from({ length: Math.ceil(rs.length / cols) }, (_, k) => rs.slice(k * cols, k * cols + cols)));
  const W = 210, GAPX = narrow ? 50 : 130, GAPY = 74, LH = 15;
  const box = {}, elAt = {};
  const widest = Math.max(...rowsIn.map((rs) => rs.length));
  let y = 0;
  for (const rs of rowsIn) {
    const x0 = ((widest - rs.length) * (W + GAPX)) / 2;
    let tall = 0;
    rs.forEach((r, i) => {
      const els = M.elements.filter((e) => e.room === r.id);
      const h = 52 + els.length * LH;
      box[r.id] = { x: x0 + i * (W + GAPX), y, w: W, h };
      els.forEach((e, k) => { elAt[e.id] = [x0 + i * (W + GAPX) + W, y + 60 + k * LH - 4, x0 + i * (W + GAPX)]; });
      tall = Math.max(tall, h);
    });
    y += tall + GAPY;
  }
  const gE = el('g'), gN = el('g'), gK = el('g'), gL = el('g');
  const cur = STEPS[S.step - 1], curRoom = cur?.room;
  const hotLocks = new Set([...(cur?.serves ?? []).map((x) => x.lock), ...(cur?.opens ?? [])]);
  const lockColor = new Map();
  [...M.links.filter((l) => l.keys.length && l.door), ...M.cages.map((c) => ({ door: c.element }))].forEach((l, i) => lockColor.set(l.door, LOCKS[i % LOCKS.length]));
  const mid = {};
  // the links: down from a room's foot to the next one's head, or round the side within a row
  for (const l of M.links) {
    const A = box[l.a], Bx = box[l.b];
    if (!A || !Bx) continue;
    let d, mx, my;
    if (Math.abs(A.y - Bx.y) < 1) {
      const right = Bx.x > A.x, ax = right ? A.x + A.w : A.x, bx = right ? Bx.x : Bx.x + Bx.w, ay = A.y + 18, by = Bx.y + 18;
      d = `M${ax},${ay} L${bx},${by}`; mx = (ax + bx) / 2; my = ay;
    } else {
      const down = Bx.y > A.y, ax = A.x + A.w / 2 + (A.w / 4) * Math.sign(Bx.x - A.x), bx = Bx.x + Bx.w / 2 - (Bx.w / 4) * Math.sign(Bx.x - A.x);
      const ay = down ? A.y + A.h : A.y, by = down ? Bx.y : Bx.y + Bx.h, k = Math.max(30, Math.abs(by - ay) * 0.45) * (down ? 1 : -1);
      d = `M${ax},${ay} C${ax},${ay + k} ${bx},${by - k} ${bx},${by}`; mx = (ax + bx) / 2; my = (ay + by) / 2;
    }
    const col = COL[l.type] ?? COL.door, hot = hotLocks.has(l.door) || (cur?.through ?? []).includes(l.id);
    gE.append(el('path', { d, fill: 'none', stroke: col, 'stroke-width': hot ? 4.5 : l.type === 'open' ? 1.8 : 2.8, 'stroke-dasharray': l.type === 'needs' || l.type === 'oneway' ? '7 4' : null, 'marker-end': l.oneWay ? 'url(#arrow)' : null, opacity: hot || !S.step ? 1 : 0.65 }));
    mid[l.door ?? l.id] = [mx, my];
    if (l.type !== 'open') {
      const gg = el('g');
      gg.append(el('title', {}, `${l.door ?? l.id}: ${l.label}`));
      const txt = `${l.door ?? ''}${l.door ? ' · ' : ''}${{ door: 'door', gate: 'sinks once the room is cleared', locked: 'small lock', great: 'great lock', bridge: 'bridge', needs: (l.needs ?? []).join('+'), oneway: 'drop', boss: 'after the guardian', arena: 'shuts for a fight', held: 'blocked' }[l.type] ?? l.type}`;
      gg.append(el('rect', { x: mx - txt.length * 3.2 - 6, y: my - 9.5, width: txt.length * 6.4 + 12, height: 19, rx: 9, fill: hot ? '#fff2a8' : '#fffaf0', stroke: col, 'stroke-width': 1.5 }));
      gg.append(el('text', { x: mx, y: my + 4, 'font-size': 11.5, 'text-anchor': 'middle', fill: col, 'font-weight': 600 }, txt));
      gL.append(gg);
    }
  }
  // the rooms, their pieces listed inside, the steps done there as badges
  for (const r of M.rooms) {
    const b = box[r.id];
    if (!b) continue;
    const hot = r.id === curRoom || r.id === S.hover;
    const gg = el('g');
    gg.append(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 6, fill: r.boss ? '#fbe3dc' : r.entry ? '#e7f0dc' : '#fffaf0', stroke: hot ? COL.path : '#2b211f', 'stroke-width': hot ? 3.5 : 1.5 }));
    gg.append(el('text', { x: b.x + 8, y: b.y + 18, 'font-size': 14, 'font-weight': 700, fill: '#2b211f' }, r.name));
    gg.append(el('text', { x: b.x + 8, y: b.y + 33, 'font-size': 11, fill: '#7a5238' }, `${r.id}${M.floors.length > 1 ? ` · ${floorName(r.floor)}` : ''}${r.entry ? ' · way in' : ''}${r.boss ? ' · guardian' : ''}${r.kind ? ` · ${r.kind}` : ''}`));
    const here = STEPS.map((s, i) => [s, i + 1]).filter(([s]) => s.room === r.id);
    here.forEach(([s, n], k) => {
      const x = b.x + 10 + k * 17, yy = b.y + 44, on = n === S.step;
      const bg = el('g', { 'data-step': n, style: 'cursor:pointer' });
      bg.append(el('title', {}, `${s.id}: ${s.text}`));
      bg.append(el('circle', { cx: x, cy: yy, r: 7.5, fill: on ? COL.hot : COL.path, opacity: !S.step || n <= S.step ? 1 : 0.45 }));
      bg.append(el('text', { x, y: yy + 3.5, 'font-size': 9.5, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 700 }, n));
      gg.append(bg);
    });
    M.elements.filter((e) => e.room === r.id).forEach((e, k) => {
      gg.append(el('text', { x: b.x + 8, y: b.y + 64 + k * LH - 4, 'font-size': 11.5, fill: e.type === 'key' ? COL.locked : e.type === 'boss' ? COL.boss : '#2b211f' }, `${SYM[e.type] ?? '·'} ${e.id} · ${e.noun}${e.item ? `: ${e.item}` : ''}${e.hidden ? ' (hidden)' : ''}`));
    });
    gN.append(gg);
  }
  gN.addEventListener('click', (e) => { const t = e.target.closest('[data-step]'); if (t) go(Number(t.dataset.step)); });
  // each key or clue → the lock it opens (a cage: the key it frees), in the lock's colour
  for (const l of [...M.links.filter((x) => x.keys.length && x.door), ...M.cages.map((c) => ({ ...c, door: c.element }))]) {
    const to = l.room ? elAt[l.door] && [elAt[l.door][0], elAt[l.door][1]] : mid[l.door];
    if (!to) continue;
    const col = lockColor.get(l.door) ?? LOCKS[0], hot = hotLocks.has(l.door);
    for (const k of l.keys) {
      if (['resolved', 'needs', 'item', 'cleared', 'gadget', 'open'].includes(k.how)) continue;
      const from = elAt[k.id];
      if (!from) continue;
      const [x1, y1] = [from[0], from[1] - 4], [x2, y2] = to, bow = Math.max(40, Math.abs(y2 - y1) * 0.25);
      gK.append(el('path', { d: `M${x1},${y1} C${x1 + bow},${y1} ${x2 + bow},${y2} ${x2 + 4},${y2}`, fill: 'none', stroke: col, 'stroke-width': hot ? 2.8 : 1.4, 'stroke-dasharray': k.how === 'key' ? '6 3' : '3 3', opacity: hot ? 1 : S.step ? 0.3 : 0.75, 'marker-end': 'url(#keyhead)' }));
    }
  }
  g.append(gE, gN, gK, gL);
  const xs = Object.values(box).flatMap((b) => [b.x, b.x + b.w]), ys = Object.values(box).flatMap((b) => [b.y, b.y + b.h]);
  return { g, box: { x: Math.min(...xs) - 30, y: Math.min(...ys) - 20, w: Math.max(...xs) - Math.min(...xs) + 120, h: Math.max(...ys) - Math.min(...ys) + 40 }, top: true };
}

// ------------------------------------------------------------------ draw
const defs = `<defs>
  <marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${COL.hot}"/></marker>
  <marker id="up" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#5a3a22"/></marker>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${COL.oneway}"/></marker>
  <marker id="keyhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="context-stroke"/></marker>
</defs>`;
let lastView = null;
function draw() {
  if (S.view === 'three') { three(); return; }
  const { g, box, top = false } = S.view === 'plan' ? plan() : graph();
  svg.innerHTML = defs;
  svg.append(g);
  content = { ...box, top };
  if (!VB[S.view] || lastView !== S.view) { if (!VB[S.view]) fit(); else vbSet(); }
  lastView = S.view;
}
function refresh() {
  save();
  for (const b of $('#views').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === S.view));
  $('#stage').classList.toggle('three', S.view === 'three');
  $('#zoom').style.display = S.view === 'three' ? 'none' : '';
  $('#legend').style.display = S.view === 'three' ? 'none' : '';
  sub(); solution(); numbers(); legend(); draw();
}
for (const b of $('#views').querySelectorAll('button')) b.addEventListener('click', () => { if (!b.disabled) { S.view = b.dataset.view; refresh(); } });
addEventListener('resize', () => { if (S.view === 'three') three(); else { VB[S.view] = null; draw(); } });

// ------------------------------------------------------------------ the 3D view (a makers' temple: its built rooms, flat shaded)
let T3 = null;
function three() {
  if (!B) return;
  if (!T3) {
    const canvas = $('#view');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setClearColor('#efe6d2');
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
    // the cheap look: every mesh in its own colour, flat shaded; hidden proxies and the guardian's effects left out
    const mats = new Map();
    const cheap = (m) => {
      if (!mats.has(m.uuid)) { const c = m.uniforms?.uColor?.value ?? m.color ?? null; mats.set(m.uuid, new THREE.MeshLambertMaterial({ color: c?.isColor ? c.clone() : new THREE.Color('#d9ccb0'), side: THREE.DoubleSide, transparent: !!m.transparent, opacity: m.transparent ? 0.35 : 1 })); }
      return mats.get(m.uuid);
    };
    const drop = [];
    scene3.traverse((o) => { if (o.isPoints || o.isLine || o.isSprite) { drop.push(o); return; } if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(cheap) : cheap(o.material); });
    for (const o of drop) o.parent?.remove(o);
    scene3.add(new THREE.HemisphereLight('#fff8e8', '#8a7a68', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(80, 160, 40); scene3.add(sun);
    const marks = new THREE.Group(); scene3.add(marks);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    const W = (p) => B.rt.kit.world(p[0], p[1], p[2]);
    const [x0, z0, x1, z1] = M.plan.bounds, c = W([(x0 + x1) / 2, 0, (z0 + z1) / 2]), span = Math.max(x1 - x0, z1 - z0);
    controls.target.copy(c);
    camera.position.copy(c).add(new THREE.Vector3(span * 0.55, span * 0.75, span * 0.55));
    T3 = { renderer, camera, controls, marks, W, dirty: true };
    controls.addEventListener('change', () => { T3.dirty = true; });
    const loop = () => { requestAnimationFrame(loop); if (S.view !== 'three') return; controls.update(); if (T3.dirty) { renderer.render(scene3, camera); T3.dirty = false; } };
    loop();
  }
  const { renderer, camera, marks, W } = T3;
  // (the roofs cut away: everything over the floor looked at, or the top floor, by more than a storey is not drawn)
  const fl = M.floors.find((f) => f.id === S.floor) ?? M.floors.at(-1);
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), W([0, fl.top + 7, 0]).y)];
  const cv = $('#view'), w = cv.clientWidth, h = cv.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  // the walk and the steps
  marks.clear();
  const pts = STEPS.flatMap((s) => (s.path ?? []).map((p) => W([p[0], p[1] + 1.2, p[2]])));
  if (pts.length > 1) marks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.path, depthTest: false, transparent: true })));
  STEPS.forEach((s, i) => {
    const cur = i + 1 === S.step;
    const m = new THREE.Mesh(new THREE.SphereGeometry(cur ? 1.6 : 0.9, 14, 10), new THREE.MeshBasicMaterial({ color: cur ? COL.hot : COL.path, depthTest: false, transparent: true }));
    m.position.copy(W([s.pos[0], s.pos[1] + 1.2, s.pos[2]])); m.renderOrder = 10; marks.add(m);
  });
  T3.dirty = true;
}

refresh();
if (S.step) go(S.step);
