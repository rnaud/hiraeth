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
import { themeToListen } from '../music-store.js';

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

let fetching = null;   // the recording being fetched for its card ({ id }), on a device (themeToListen)
const cancelFetch = () => { if (fetching) setPlaying(fetching.id, false); fetching = null; };
const card = (id) => document.getElementById(anchorOf(id));
const setPlaying = (id, on) => { const c = card(id), b = c?.querySelector('.play'); c?.classList.toggle('playing', on); if (b) b.textContent = on ? '■ Stop' : '▶ Play'; };
const playerOptions = {
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
};
let player = new Player(playerOptions);
$('#volume').addEventListener('input', (e) => player.setVolume(Number(e.target.value)));
$('#world').addEventListener('change', (e) => player.setWorld(e.target.value));
let playRequest = 0, effectsFailed = false;
$('#stop').addEventListener('click', () => { ++playRequest; cancelFetch(); const volume = player.vol; player.dispose(); player = new Player(playerOptions); player.setVolume(volume); status(''); });

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const c = b.closest('article'), id = c.dataset.id, entry = byId.get(id);
  const request = ++playRequest, owner = player, act = b.dataset.act;
  // Stopping a song never waits for an unrelated effect download.
  if (act === 'file' && fetching?.id === id) { cancelFetch(); status(''); return; }
  if (owner.playing(id)) {
    if (act === 'file') owner.stopFile(); else if (act === 'score') owner.stopScore(); else owner.stopLoop(id);
    return;
  }
  try {
    owner.setWorld($('#world').value);
    if (act === 'fx') status('Loading sound effects…');
    let prepared;
    try {
      prepared = await owner.preparePreview({ effects: act === 'fx', retry: effectsFailed, current: () => request === playRequest && owner === player });
      if (act === 'fx') effectsFailed = false;
    } catch (error) {
      if (act !== 'fx') throw error;
      effectsFailed = true; console.error('[effects]', error);
      throw new Error('Sound effects couldn’t load. Press Play to retry.');
    }
    if (!prepared) return;
    if (act === 'fx' || act === 'tune') {
      owner.play(entry.variants[Number(b.dataset.i)][1]);
      status(`${entry.name}: ${entry.variants[Number(b.dataset.i)][0]}`);
      return;
    }
    if (act === 'file') {
      player.stopAll();
      cancelFetch();
      const ask = fetching = { id };
      setPlaying(id, true);
      // (on a device: the bundle's, the kept copy, or downloaded from the site now and kept: src/music-store.js themeToListen)
      const theme = await themeToListen(entry.file, { onDownload: () => status(`Downloading ${c.querySelector('h3').textContent}…`) })
        .catch((err) => { if (fetching === ask) { fetching = null; setPlaying(id, false); throw err; } return null; });
      if (fetching !== ask) { theme?.revoke(); return; }   // (stopped, or another song asked for, while it downloaded)
      fetching = null;
      await player.playFile(id, theme.url, theme.revoke).catch((err) => { setPlaying(id, false); theme.revoke(); throw new Error(`${entry.file} could not play here (${err.message || err.name})`); });
    } else if (act === 'score') {
      cancelFetch();
      player.playScore(id, entry.scoreId, {
        seed: Number(c.querySelector('.seed').value) || 0, secs: Math.max(5, Number(c.querySelector('.secs').value) || 90),
        act: c.querySelector('.act').value, ambience: c.querySelector('.amb').checked, light: !!c.querySelector('.light')?.checked,
      });
      setPlaying(id, true);
    } else {
      cancelFetch();
      player.startLoop(id, { ...entry, mode: c.querySelector('.mode')?.value });
      setPlaying(id, true);
    }
    status(`Playing ${c.querySelector('h3').textContent}`);
  } catch (err) { if (request === playRequest) status(err.message || String(err), true); }
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
window.__musicPage = { get player() { return player; }, SONGS, EFFECTS };
