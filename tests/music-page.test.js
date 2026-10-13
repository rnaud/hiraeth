// The music page (music.html, src/music-page/, docs/systems/audio.md "The music page"; issue #270): every song the game
// plays and every sound effect is in its catalogue (a new sound can't be missed), every entry plays on the engines'
// in-memory context without a fault, the page is built, linked from the Debug menu, and its notes file issues the
// lore page's way with the music page's footer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { installAudio } from '../engine/webaudio.js';
import { BUILD_INPUT } from '../vite.config.js';
import { PAGES } from '../src/world-picker.js';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
const cat = await import('../src/music-page/catalog.js');
const { Sound } = await import('../src/audio.js');
const ship = await import('../src/ship/sfx.js');
const { SFX } = await import('../src/sfx.js');
const { FOE_VOICES } = await import('../src/foe-voices.js');
const { SCORES } = await import('../src/score.js');
const { SOUNDTRACKS, TITLE_THEME, CUES } = await import('../src/soundtracks.js');
const { KINDS } = await import('../src/score-voices.js');
const { LANGUAGES } = await import('../src/story/voice.js');
const ids = new Set([...cat.EFFECTS, ...cat.SONGS].map((x) => x.id));

test('the music page: built, linked from the Debug menu, with its way back', () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/music.html')), 'vite builds music.html');
  assert.ok(PAGES.some((p) => p.href === 'music.html'), 'in the Debug menu\'s Pages');
  const page = readFileSync(new URL('../music.html', import.meta.url), 'utf8');
  assert.match(page, /src="\/src\/music-page\/main\.js"/);
  assert.match(page, /<dialog id="note-box"/);
});

test('every method of Sound is a sound on the page, or named as its plumbing', () => {
  const src = cat.catalogueSource();
  const proto = Sound.prototype, missing = [];
  for (const k of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, k);
    if (typeof d.value !== 'function' || Object.hasOwn(cat.PLUMBING, k)) continue;
    if (!new RegExp(`\\bs\\.${k}\\(`).test(src)) missing.push(k);
  }
  assert.deepEqual(missing, [], 'add these to src/music-page/catalog.js (or to PLUMBING if they make no sound of their own)');
  for (const k of Object.keys(cat.PLUMBING)) assert.ok(k in proto, `PLUMBING names ${k}, which Sound no longer has`);
});

test('every song, sample group, foe voice, instrument, voice and ship sound is listed', () => {
  for (const f of new Set([...Object.values(SOUNDTRACKS), TITLE_THEME, ...Object.values(CUES)])) assert.ok(ids.has(`file:${f.replace(/\.mp3$/, '')}`) || [...ids].some((i) => i.startsWith('cue:') && CUES[i.slice(4)] === f), f);
  const manifest = JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8'));
  for (const t of manifest.tracks) assert.ok(cat.SONGS.some((s) => s.file === t.file), `manifest: ${t.file}`);
  const onDisk = readdirSync(new URL('../public/music/', import.meta.url)).filter((f) => f.endsWith('.mp3'));
  for (const f of onDisk) assert.ok(cat.SONGS.some((s) => s.file === f), `public/music/${f} is on the page (or should it go?)`);
  for (const id of Object.keys(SCORES)) assert.ok(ids.has(`score:${id}`), `score ${id}`);
  for (const g of Object.keys(SFX)) assert.ok(ids.has(`sample:${g}`), `sample ${g}`);
  for (const k of Object.keys(FOE_VOICES)) assert.ok(ids.has(`foe:${k}`), `foe ${k}`);
  for (const k of [...KINDS.notes, ...KINDS.held]) assert.ok(ids.has(`instrument:${k}`), `instrument ${k}`);
  for (const k of KINDS.hits) assert.ok(ids.has(`hit:${k}`), `hit ${k}`);
  for (const k of KINDS.colours) assert.ok(ids.has(`colour:${k}`), `colour ${k}`);
  for (const k of Object.keys(LANGUAGES)) assert.ok(ids.has(`voice:${k}`), `language ${k}`);
  for (const k of Object.keys(ship)) assert.ok(ids.has(`ship:${k}`), `src/ship/sfx.js ${k}`);
  assert.equal(ids.size, cat.EFFECTS.length + cat.SONGS.length, 'every id once');
  assert.ok(ids.has('keyGet') && ids.has('keyTurn'), 'the keys\' chime and click (issue #274)');
});

test('every effect, tune and loop plays on the in-memory context, finite, and something is heard', async () => {
  const saved = G.AudioContext, setT = G.setTimeout, setI = G.setInterval;
  // (the sounds' clean-ups and the schedulers, unref'd: the test ends when it is done, not when they would have)
  G.setTimeout = (...a) => { const h = setT(...a); h?.unref?.(); return h; };
  G.setInterval = (...a) => { const h = setI(...a); h?.unref?.(); return h; };
  delete G.AudioContext; installAudio(G);
  const s = new Sound('desert', { score: false, muted: false });
  s.start(); s._unlisten?.();
  s.listen({ x: 0, y: 1.6, z: 0 }, 0);
  const pending = [];
  const e = { at: { x: 2, y: 1.6, z: -4 }, later: (secs, fn) => pending.push(fn), hold: (secs, tick, end) => { tick(); s.ctx.render(4800); tick(); end?.(); }, phase: () => 0.6 };
  const rms = (a) => { let q = 0; for (let i = 0; i < a.length; i++) q += a[i] * a[i]; return Math.sqrt(q / Math.max(1, a.length)); };
  try {
    s.ctx.render(48000);
    const quiet = [];
    const run = (label, fn) => {
      assert.doesNotThrow(() => fn(s, e), label);
      while (pending.length) pending.shift()();
      const out = s.ctx.render(9600);
      assert.ok(out.every(Number.isFinite), `${label}: finite`);
      if (rms(out) < 1e-6) quiet.push(label);
    };
    for (const fx of cat.EFFECTS) for (const [v, fn] of fx.variants) run(`${fx.id} ${v}`, fn);
    for (const t of cat.TUNES) {
      if (t.variants) for (const [v, fn] of t.variants) run(`${t.id} ${v}`, fn);
      if (t.start) { run(`${t.id} start`, t.start); run(`${t.id} stop`, t.stop); }
    }
    // (the recorded takes need the bank's files, which node doesn't fetch: their synth stands in or nothing plays)
    const silent = quiet.filter((l) => !l.startsWith('sample:'));
    assert.ok(silent.length <= 3, `heard: ${silent.join(', ')}`);
  } finally {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); clearInterval(s.combatTimer); clearTimeout(s._preload);
    G.setTimeout = setT; G.setInterval = setI;
    if (saved) G.AudioContext = saved; else delete G.AudioContext;
  }
});

test('a note from the music page: the Notes API, its id and link, the music page\'s footer', async () => {
  const { noteRequest, noteText, fileMusicNote, MUSIC_URL } = await import('../src/music-page/notes.js');
  const { handleIssues, SOURCES } = await import('../worker/issues.js');
  const { anchorOf } = await import('../src/music-page/view.js');
  const ref = { anchor: anchorOf('keyGet'), id: 'keyGet', label: 'A temple key (Chests, keys and items)' };
  assert.equal(MUSIC_URL, 'https://hiraeth.alexandria-rnaud.workers.dev/music');
  assert.equal(noteText('Too shrill\nLower it.', ref), 'Too shrill\nLower it.\n\nOn the music page: **A temple key (Chests, keys and items)** (`keyGet`, https://hiraeth.alexandria-rnaud.workers.dev/music#s-keyget)');
  const calls = [];
  const issue = await fileMusicNote('Too shrill', ref, async (url, options) => { calls.push({ url, options }); return Response.json({ issue: { number: 9 } }, { status: 201 }); });
  assert.equal(issue.number, 9);
  assert.equal(calls[0].url, '/api/notes/issues');
  assert.deepEqual(JSON.parse(calls[0].options.body), noteRequest('Too shrill', ref));
  assert.equal(SOURCES.music, 'Added from the Hiraeth music page.');
  const origin = 'https://notebook.example', now = Date.UTC(2026, 9, 13), allow = { limit: async () => ({ success: true }) };
  const env = { HIRAETH_ISSUES_TOKEN: 't', HIRAETH_NOTES_PASSWORD: 'pw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
  const post = (path, body, cookie) => new Request(`${origin}/api/notes/${path}`, { method: 'POST', body: JSON.stringify(body), headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
  const cookie = (await handleIssues(post('session', { password: 'pw' }), env, () => { throw new Error('no GitHub'); }, now)).headers.get('Set-Cookie').split(';')[0];
  const sent = [];
  await handleIssues(post('issues', noteRequest('Too shrill', ref), cookie), env, async (url, o) => { sent.push(JSON.parse(o.body)); return Response.json({ number: 7, title: 'x', labels: [] }, { status: 201 }); }, now);
  assert.equal(sent[0].body, `${noteText('Too shrill', ref)}\n\n${SOURCES.music}`);
});

test('the cards: every entry with its Note, its anchor and its buttons', async () => {
  const { musicPage, anchorOf } = await import('../src/music-page/view.js');
  const { main, nav } = musicPage({ songs: cat.SONGS, effects: cat.EFFECTS, groups: cat.EFFECT_GROUPS, manifest: JSON.parse(readFileSync(new URL('../public/music/manifest.json', import.meta.url), 'utf8')) });
  for (const x of [...cat.SONGS, ...cat.EFFECTS]) assert.ok(main.includes(`id="${anchorOf(x.id)}"`), x.id);
  assert.equal((main.match(/class="note-btn"/g) ?? []).length, ids.size, 'a Note on each');
  assert.equal(new Set([...ids].map(anchorOf)).size, ids.size, 'anchors unique');
  assert.match(main, /Descent into D Bayati/, 'the Suno titles from the manifest');
  assert.match(main, /class="seed"/, 'a score: its seed, length and activity');
  assert.match(nav, /href="#sec-/);
});
