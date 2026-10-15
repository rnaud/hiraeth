import { MARK_CANDIDATES, markById, markPath, markSource } from './candidates.js';
import { MARK_VIEWS } from './runtime.js';
import './style.css';
const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
let id = markById(q.get('mark'))?.id ?? 'corner';
let view = MARK_VIEWS[q.get('view')] ? q.get('view') : 'door';
let range = ['near', 'middle', 'far'].includes(q.get('range')) ? q.get('range') : 'near';
let ready = false;
function url() { return `./index.html?${new URLSearchParams({level:'desert',markReview:'1',mark:id,markView:view,range})}`; }
function update() {
  const mark = markById(id);
  $('name').textContent = mark?.name ?? 'Previous mark'; $('description').textContent = mark?.description ?? 'The former dots-and-arc design.';
  $('view').value = view;
  $('source').hidden = !mark; if (mark) $('source').href = markSource(mark);
  document.querySelectorAll('[data-mark]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mark === id)));
  document.querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.range === range)));
  $('distance').textContent = `${MARK_VIEWS[view].distances[['near','middle','far'].indexOf(range)]} m`;
  $('direct').href = url();
  history.replaceState(null, '', `?${new URLSearchParams({mark:id,view,range})}`);
}
function select(mark) {
  id = mark; ready = false; update(); $('loading').hidden = false;
  $('status').textContent = 'Loading the selected geometry…'; $('world').src = url();
}
function show() { update(); if (ready) $('world').contentWindow.postMessage({type:'makers-mark-view',view,range},location.origin); else $('world').src = url(); }
for (const [i,m] of MARK_CANDIDATES.entries()) {
  const b = document.createElement('button'); b.dataset.mark = m.id;
  b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${m.paths.map(p=>`<path d="${markPath(p)}"/>`).join('')}</svg><span><small>OPTION ${i+1}</small>${m.name}</span>`;
  b.onclick = () => select(m.id); $('candidates').append(b);
}
const original = document.createElement('button'); original.dataset.mark = 'current'; original.className = 'current'; original.textContent = 'Compare previous mark'; original.onclick = () => select('current'); $('candidates').append(original);
$('view').onchange = () => { view = $('view').value; show(); };
document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {range=b.dataset.range;show();});
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== $('world').contentWindow || e.data?.type !== 'makers-mark-ready' || e.data.candidate !== id) return;
  ready = true; $('loading').hidden = true; $('status').textContent = `Live game · ${MARK_VIEWS[e.data.view].name} · ${e.data.distance} m`;
});
select(q.get('mark') === 'current' ? 'current' : id);
