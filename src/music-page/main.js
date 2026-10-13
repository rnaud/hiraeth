// The music page (music.html, docs/systems/audio.md "The music page"; issue #270): every song and every sound effect
// of the game, to listen to, each with a Note (src/music-page/notes.js). The catalogue is src/music-page/catalog.js,
// the cards src/music-page/view.js, the sound the game's own (src/music-page/player.js).
import { SONGS, EFFECTS, EFFECT_GROUPS } from './catalog.js';
import { musicPage, anchorOf } from './view.js';
import { Player } from './player.js';
import { TITLES } from '../levels/names.js';
import { SCORES } from '../score.js';
import { setupNoteBox } from '../lore-page/note-box.js';
import { MUSIC_URL, fileMusicNote } from './notes.js';

const $ = (s) => document.querySelector(s);
const byId = new Map([...SONGS, ...EFFECTS].map((x) => [x.id, x]));
const fmt = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '–');
const status = (t, error = false) => { const el = $('#status'); el.textContent = t; el.classList.toggle('error', error); };

function render(manifest) {
  const { nav, main } = musicPage({ songs: SONGS, effects: EFFECTS, groups: EFFECT_GROUPS, manifest });
  $('#sections').innerHTML = nav;
  $('#list').innerHTML = main;
  $('#count').textContent = `${SONGS.length} songs · ${EFFECTS.length} sounds`;
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
render(null);
fetch('music/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m) render(m); }).catch(() => {});

// the world whose scale the effects sing in
$('#world').innerHTML = Object.keys(SCORES).map((id) => `<option value="${id}">${TITLES[id] ?? id}</option>`).join('');

const card = (id) => document.getElementById(anchorOf(id));
const setPlaying = (id, on) => { const c = card(id), b = c?.querySelector('.play'); c?.classList.toggle('playing', on); if (b) b.textContent = on ? '■ Stop' : '▶ Play'; };
const player = new Player({
  onState: (st) => {
    if (st.kind === 'stopped') { setPlaying(st.id, false); return; }
    const c = card(st.id);
    if (!c) return;
    c.querySelector('.time').textContent = `${fmt(st.at)} / ${fmt(st.len)}`;
    const seek = c.querySelector('.seek');
    if (seek && !seek.matches(':active') && st.len) seek.value = String(Math.round((st.at / st.len) * 1000));
    const prog = c.querySelector('.prog');
    if (prog && st.len) prog.value = st.at / st.len;
  },
});
$('#volume').addEventListener('input', (e) => player.setVolume(Number(e.target.value)));
$('#world').addEventListener('change', (e) => player.setWorld(e.target.value));
$('#stop').addEventListener('click', () => player.stopAll());

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const c = b.closest('article'), id = c.dataset.id, entry = byId.get(id);
  try {
    if (!player.s) player.setWorld($('#world').value);
    await player.ready();
    const act = b.dataset.act;
    if (act === 'fx' || act === 'tune') {
      const r = player.play(entry.variants[Number(b.dataset.i)][1]);
      if (act === 'fx' && id.startsWith('sample:') && r === false) status('The recorded takes are still loading: the synth stood in. Press again in a moment.');
      else status(`${entry.name}: ${entry.variants[Number(b.dataset.i)][0]}`);
      return;
    }
    if (player.playing(id)) {
      if (act === 'file') player.stopFile(); else if (act === 'score') player.stopScore(); else player.stopLoop(id);
      return;
    }
    if (act === 'file') {
      player.stopAll();
      setPlaying(id, true);
      await player.playFile(id, `music/${entry.file}`).catch((err) => { setPlaying(id, false); throw new Error(`${entry.file} could not play here (${err.message || err.name}): on a device only the bundled themes are there.`); });
    } else if (act === 'score') {
      player.playScore(id, entry.scoreId, {
        seed: Number(c.querySelector('.seed').value) || 0, secs: Math.max(5, Number(c.querySelector('.secs').value) || 90),
        act: c.querySelector('.act').value, ambience: c.querySelector('.amb').checked, light: !!c.querySelector('.light')?.checked,
      });
      setPlaying(id, true);
    } else {
      player.startLoop(id, { ...entry, mode: c.querySelector('.mode')?.value });
      setPlaying(id, true);
    }
    status(`Playing ${c.querySelector('h3').textContent}`);
  } catch (err) { status(err.message || String(err), true); }
});
document.addEventListener('input', (e) => {
  const seek = e.target.closest('.seek');
  if (seek && player.file?.id === seek.closest('article').dataset.id) player.seek(Number(seek.value) / 1000);
});

// the search
$('#search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const a of document.querySelectorAll('#list article')) a.hidden = !!q && !a.dataset.q.includes(q);
  for (const s of document.querySelectorAll('#list section')) s.hidden = !s.querySelector('article:not([hidden])');
});

setupNoteBox({ siteUrl: MUSIC_URL, file: (text, ref) => fileMusicNote(text, ref) });
// (a dev hook for checks: the page's player)
window.__musicPage = { player, SONGS, EFFECTS };
