// The music page's cards (music.html): pure HTML from the catalogue (src/music-page/catalog.js) and the manifest of
// the recordings (public/music/manifest.json); src/music-page/main.js wires the buttons. tests/music-page.test.js.
import { ACTS } from './catalog.js';
import { SCORES } from '../score.js';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** An entry's anchor on the page (its id, made safe for a URL fragment). */
export const anchorOf = (id) => `s-${String(id).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
const note = (id, label) => `<button class="note-btn" type="button" data-note="${esc(anchorOf(id))}" data-id="${esc(id)}" data-label="${esc(label)}" title="Leave a note on this">Note</button>`;
const words = (...t) => esc(t.filter(Boolean).join(' ').toLowerCase());

/** The manifest's entry for a file ({ title, source, prompt, direction, note }), or null. */
export function manifestFor(manifest, file) {
  if (!manifest) return null;
  if (manifest.title?.file === file) return manifest.title;
  return [...(manifest.tracks ?? []), ...(manifest.scenes ?? [])].find((t) => t.file === file) ?? null;
}

function head(id, title, sub, label = title) {
  return `<div class="head"><h3>${esc(title)}</h3>${note(id, label)}</div>${sub ? `<p class="meta">${esc(sub)}</p>` : ''}`;
}

/** One song's card. */
export function songCard(song, manifest = null) {
  const a = anchorOf(song.id);
  let body = '', title = song.name, kind = '';
  if (song.kind === 'file') {
    const m = manifestFor(manifest, song.file);
    title = m?.title ?? song.name;
    kind = song.cue ? 'recorded cue' : 'recorded (Suno)';
    body = `<p class="where">${esc(song.where)}</p>
      ${m?.direction ? `<p class="dir">${esc(m.direction)}</p>` : ''}
      <div class="transport"><button class="play" data-act="file">▶ Play</button><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="time">0:00</span></div>
      <p class="small">${esc(song.file)}${m?.source ? ` · <a href="${esc(m.source)}" target="_blank" rel="noopener noreferrer">on Suno ↗</a>` : ''}${m?.created ? ` · ${esc(m.created)}` : ''}</p>
      ${m?.prompt ? `<details><summary>its prompt</summary><p class="small">${esc(m.prompt)}</p></details>` : ''}`;
  } else if (song.kind === 'score') {
    kind = 'procedural score';
    const moments = SCORES[song.scoreId]?.moments;
    body = `<p class="where">${esc(song.where)}</p><p class="dir">${esc(song.params)}</p>
      <div class="opts">
        <label>seed <input class="seed" type="number" min="0" max="99" value="0" title="the arc it starts on: each arc draws its own order of sections"></label>
        <label>length <input class="secs" type="number" min="10" max="900" step="10" value="90"> s</label>
        <label>while <select class="act">${Object.keys(ACTS).map((k) => `<option${k === 'walking' ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
        <label><input class="amb" type="checkbox"> its ambience</label>
        ${moments ? '<label title="between its moments: only its light layers"><input class="light" type="checkbox"> light layers</label>' : ''}
      </div>
      <div class="transport"><button class="play" data-act="score">▶ Play</button><progress class="prog" max="1" value="0"></progress><span class="time">0:00</span></div>`;
  } else if (song.kind === 'loop' || song.kind === 'band') {
    kind = song.kind === 'band' ? 'musicians (procedural)' : 'procedural';
    body = `<p class="where">${esc(song.where)}</p>
      ${song.kind === 'band' ? `<div class="opts"><label>mode <select class="mode">${song.band.modes.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label></div>` : ''}
      <div class="transport"><button class="play" data-act="loop">▶ Play</button></div>`;
  } else {
    kind = 'tune (procedural)';
    body = `<p class="where">${esc(song.where)}</p><div class="vars">${song.variants.map(([label], i) => `<button class="var" data-act="tune" data-i="${i}">▶ ${esc(label)}</button>`).join('')}</div>`;
  }
  return `<article id="${a}" class="card song ${song.kind}" data-id="${esc(song.id)}" data-q="${words(title, song.name, song.where, song.id, kind, song.world)}">
    ${head(song.id, title, kind, `${title} (${kind})`)}${body}</article>`;
}

/** One effect's card: its variants as buttons. */
export function effectCard(fx) {
  return `<article id="${anchorOf(fx.id)}" class="card fx" data-id="${esc(fx.id)}" data-group="${esc(fx.group)}" data-q="${words(fx.name, fx.where, fx.id, fx.group, ...fx.variants.map(([l]) => l))}">
    ${head(fx.id, fx.name, fx.where, `${fx.name} (${fx.group})`)}
    <div class="vars">${fx.variants.map(([label], i) => `<button class="var" data-act="fx" data-i="${i}">▶ ${esc(label)}</button>`).join('')}</div></article>`;
}

/** The whole page: the songs, then each group of effects, each in its section. */
export function musicPage({ songs, effects, groups, manifest = null }) {
  const sec = (key, title, cards, count) => `<section class="band" data-sec="${esc(key)}" id="sec-${anchorOf(key)}"><h2>${esc(title)} <small>${count}</small></h2><div class="grid">${cards}</div></section>`;
  const parts = [
    sec('recorded', 'Songs: recorded', songs.filter((s) => s.kind === 'file').map((s) => songCard(s, manifest)).join(''), songs.filter((s) => s.kind === 'file').length),
    sec('scores', 'Songs: each world\'s score (procedural)', songs.filter((s) => s.kind === 'score').map((s) => songCard(s)).join(''), songs.filter((s) => s.kind === 'score').length),
    sec('tunes', 'Songs: the other music (procedural)', songs.filter((s) => !['file', 'score'].includes(s.kind)).map((s) => songCard(s)).join(''), songs.filter((s) => !['file', 'score'].includes(s.kind)).length),
    ...groups.map((g) => { const list = effects.filter((x) => x.group === g); return sec(g, `Effects: ${g}`, list.map(effectCard).join(''), list.length); }),
  ];
  const nav = [['recorded', 'Recorded'], ['scores', 'Scores'], ['tunes', 'Other music'], ...groups.map((g) => [g, g])]
    .map(([k, l]) => `<a class="chip" href="#sec-${anchorOf(k)}">${esc(l)}</a>`).join('');
  return { nav, main: parts.join('') };
}
