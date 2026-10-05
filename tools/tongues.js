// The test page for the worlds' scripts (tools/tongues.html, served by the dev server):
// every script with a line in it, the same line half said, and its glyph inventory.
import { SCRIPTS, lineSvg, glyphSvg } from '../src/story/scripts.js';
import { revealHtml, LAG } from '../src/story/dialogue.js';
import { REVEAL_CPS } from '../src/story/voice.js';

const LINES = {
  desert: 'The water has not risen this year. Go down to the *giant’s heart*, child, and see what lies across the channel.',
  incal: 'Up on the rim they call it a tourist story. Down here we pray to it. A light nobody looks at goes out.',
  arzach: 'Gone. Her track, there. Blow the whistle, and wait with me a while.',
  arzach2: 'The bell has not rung in thirty years. When it stopped, everything loose fell up into the cloud.',
  garage: 'Up is a matter of opinion. The board ticks all day, and nobody here can read it. Not even the Major.',
  buried: 'I am forty-one teeth old. The wheel turns one tooth a year, and we count our lives by it.',
  edena: 'Nothing that falls should be dug up again. The garden took their ship, and the garden keeps it.',
  spheres: 'Each sphere remembers one sound: the last it heard before it came down. Put your ear to it. Listen.',
  perdide: 'The patient are never eaten. Thirty years I have kept these eggs warm, and none of them has hatched.',
  perdide2: 'You’re the first who ever came… I don’t know what to do with my hands. Come, the lamps are lit for you.',
  bazaar: 'The first thing anyone ever sold here was an answer. Madame Sel kept the silent tower for forty years!',
  atelier: 'Draw it again, slower this time, and let the line find its own way across the page.',
};

const q = new URLSearchParams(location.search);
const still = q.has('still'), only = q.get('only');
if (q.get('size')) document.documentElement.style.setProperty('--panel-size', `${q.get('size')}px`);   // ?size=30: a closer look
const cards = document.getElementById('cards'), live = [];
for (const S of Object.values(SCRIPTS)) {
  if (only && S.id !== only) continue;
  const line = LINES[S.id];
  const card = document.createElement('section');
  card.className = 'card'; card.id = `s-${S.id}`;
  card.innerHTML = `<h2>${S.name}<small>${S.world} · ${S.dir === 'rtl' ? 'right to left' : 'left to right'} · ${S.kind} · ${S.inventory.length} glyphs</small></h2>
    <p class="about">${S.about}</p>
    <div class="label">written</div><div class="panel">${lineSvg(line, S.id)}</div>
    <div class="label">being said (the translator a moment behind)</div><div class="panel reveal"></div>
    <div class="label">glyphs, commonest first</div><div class="inv">${S.inventory.map((g, k) => `<span title="${k}">${glyphSvg(S.id, k)}</span>`).join('')}</div>`;
  cards.append(card);
  live.push({ el: card.querySelector('.reveal'), line, lang: S.id });
}

// the half-said line: frozen at 60 % (?still), else said over and over at the panel's pace
const show = (x, t) => {
  const shown = Math.min(x.line.length, t * REVEAL_CPS);
  x.el.innerHTML = revealHtml(x.line, { lang: x.lang, shown, translated: t * REVEAL_CPS - LAG }) + (shown < x.line.length ? '<span style="opacity:.6">▍</span>' : '');
};
if (still) for (const x of live) show(x, (x.line.length * 0.6) / REVEAL_CPS);
else {
  const t0 = performance.now();
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    for (const x of live) show(x, t % (x.line.length / REVEAL_CPS + 2.5));
    requestAnimationFrame(frame);
  };
  frame();
}
window.__tonguesReady = true;
