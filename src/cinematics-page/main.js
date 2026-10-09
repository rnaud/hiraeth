import './style.css';
import { CINEMATICS, reviewURL } from './catalog.js';
import { mergeNotes } from './storage.js';
import { TITLES } from '../levels/names.js';
const $ = id => document.getElementById(id), key = 'hiraeth.cinematics.qc.v1';
let notes = {}, active = null, frame = null, muted = true, paused = false;
try { notes = JSON.parse(localStorage.getItem(key)) ?? {}; } catch {}
for (const group of new Set(CINEMATICS.map(e => e.group))) $('group').add(new Option(group, group));
function list() {
  const q = $('search').value.toLowerCase(), group = $('group').value;
  const entries = CINEMATICS.filter(e => (!group || e.group === group) && `${e.title} ${TITLES[e.world]} ${e.id}`.toLowerCase().includes(q));
  $('count').textContent = `${entries.length} of ${CINEMATICS.length} cinematics`;
  $('catalog').replaceChildren(...entries.map(e => {
    const button = document.createElement('button'); button.className = 'entry'; button.setAttribute('aria-current', String(active?.id === e.id));
    const title = document.createElement('strong'); title.textContent = e.title;
    const sub = document.createElement('span'); sub.textContent = `${TITLES[e.world]} · ${notes[e.id]?.verdict ?? 'Not reviewed'}`;
    button.append(title, sub); button.onclick = () => select(e); return button;
  }));
}
function select(e) {
  active = e; paused = false; muted = true;
  $('title').textContent = e.title; $('world').textContent = `${e.group} / ${TITLES[e.world]}`;
  $('verdict').value = notes[e.id]?.verdict ?? 'Not reviewed'; $('notes').value = notes[e.id]?.text ?? ''; $('badge').textContent = $('verdict').value;
  frame = document.createElement('iframe'); frame.title = e.title; frame.allow = 'fullscreen; autoplay'; frame.src = reviewURL(e); $('screen').replaceChildren(frame);
  $('direct').href = reviewURL(e); $('direct').hidden = false;
  for (const id of ['replay', 'pause', 'mute', 'full']) $(id).disabled = e.id === 'trailer' && ['pause', 'mute'].includes(id);
  $('pause').textContent = 'Pause'; $('mute').textContent = 'Sound off';
  $('status').textContent = e.id === 'trailer' ? 'Use the trailer’s playback and scrub controls.' : 'Loading the world…';
  history.replaceState(null, '', `#${encodeURIComponent(e.id)}`); list();
}
const control = (action, extra = {}) => frame?.contentWindow.postMessage({ type: 'cinematic-control', action, ...extra }, location.origin);
$('search').oninput = list; $('group').onchange = list;
$('replay').onclick = () => active && select(active);
$('pause').onclick = () => { paused = !paused; control('pause'); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
$('mute').onclick = () => { muted = !muted; control('mute', { muted }); $('mute').textContent = muted ? 'Sound off' : 'Sound on'; };
$('full').onclick = () => frame?.requestFullscreen?.();
window.addEventListener('message', e => { if (e.origin === location.origin && e.source === frame?.contentWindow && e.data?.type === 'cinematic-review') $('status').textContent = e.data.status; });
function save() { if (!active) return; notes[active.id] = { verdict: $('verdict').value, text: $('notes').value, updated: new Date().toISOString() }; try { localStorage.setItem(key, JSON.stringify(notes)); } catch { $('status').textContent = 'Notes could not be saved. Export them before leaving.'; } $('badge').textContent = $('verdict').value; list(); }
$('notes').oninput = save; $('verdict').onchange = save;
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'hiraeth-cinematics-qc.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onclick = () => $('import-file').click();
$('import-file').onchange = async () => {
  const f = $('import-file').files?.[0]; if (!f) return;
  try { notes = mergeNotes(notes, JSON.parse(await f.text())); localStorage.setItem(key, JSON.stringify(notes)); $('status').textContent = `Imported notes from ${f.name}.`; }
  catch { $('status').textContent = 'That file is not an export of QC notes.'; }
  $('import-file').value = ''; if (active) select(active); else list();
};
list(); const initial = CINEMATICS.find(e => e.id === decodeURIComponent(location.hash.slice(1))); if (initial) select(initial);
