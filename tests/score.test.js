import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORES, MODES, FATHER_THEME, scoreFor, scoreBeat, sectionAt, sectionBeats, fatherIn, degreeSemis, scoreFreq, phraseBeats, chordAt, CALM_ACT } from '../src/score.js';
import { KINDS } from '../src/score-voices.js';
import { OWN_KINDS, SPHERES_SONG } from '../src/audio.js';
import { ORDER } from '../src/levels/names.js';

const WORLDS = [...ORDER, 'home', 'atelier'];
const WALK = { ...CALM_ACT, move: 1 };
const STILL = { ...CALM_ACT, still: 60 };
const playable = new Set([...KINDS.notes, ...KINDS.held, ...OWN_KINDS]);
/** Every event of a world's first n beats. */
const events = (id, n, act = CALM_ACT) => { const out = []; for (let b = 0; b < n; b++) for (const e of scoreBeat(id, b, act)) out.push({ ...e, beat: b }); return out; };
const sign = (x) => Math.sign(x);

test('every world on the route, home and the atelier has a score of its own', () => {
  for (const id of WORLDS) {
    const S = SCORES[id];
    assert.ok(S, `${id} has a score`);
    assert.ok(S.title && S.root > 80 && S.root < 300 && S.tempo >= 40 && S.tempo <= 110, `${id}: title, root, tempo`);
    assert.ok(S.motif.filter(([d]) => d !== null).length >= 5, `${id}: a leitmotif`);
  }
  // no two route worlds share a mode on the same root, nor their lead, pluck and drone
  const keys = new Set(ORDER.map((id) => `${SCORES[id].mode}@${SCORES[id].root}`));
  assert.equal(keys.size, ORDER.length);
  const pals = new Set(ORDER.map((id) => { const P = SCORES[id].pal; return `${P.lead}/${P.pluck}/${P.drone}`; }));
  assert.equal(pals.size, ORDER.length);
  // unknown ids (the title, the Lab) fall back to the desert's
  assert.equal(scoreFor('lab'), SCORES.desert);
});

test('scales: each world plays its named mode, and every note it plays is in it', () => {
  for (const id of WORLDS) {
    const S = scoreFor(id);
    assert.deepEqual(S.scale, MODES[S.mode], `${id} is in ${S.mode}`);
    assert.equal(S.scale[0], 0);
    for (let i = 1; i < S.scale.length; i++) assert.ok(S.scale[i] > S.scale[i - 1] && S.scale[i] < 12, `${id}: an ascending octave`);
    for (const e of events(id, 400, WALK)) {
      if (e.degree === undefined) continue;
      assert.ok(Number.isInteger(e.degree), `${id}: ${e.layer} degree ${e.degree}`);
      const semi = Math.round(12 * Math.log2(scoreFreq(S, e.degree, e.octave) / S.root));
      assert.ok(S.scale.includes(((semi % 12) + 12) % 12), `${id}: ${e.kind} ${semi} is in ${S.mode}`);
    }
  }
  // the modes are what they say: hijaz's augmented second, lydian's raised fourth, whole tone's six steps
  assert.deepEqual(MODES.hijaz.slice(1, 3), [1, 4]);
  assert.ok(MODES.lydian.includes(6) && !MODES.lydian.includes(5));
  assert.ok(MODES.wholeTone.every((s, i) => s === i * 2));
  // the Garden of Spheres stays pentatonic (its song and the orbs' notes are degrees of it), Lorn heptatonic (the crystal's phrase)
  assert.equal(scoreFor('spheres').scale.length, 5);
  assert.ok(Math.max(...SPHERES_SONG.map(([d]) => d ?? 0)) <= 7);
  assert.equal(scoreFor('perdide').scale.length, 7);
});

test('every instrument a score names can be played', () => {
  for (const id of WORLDS) {
    const S = scoreFor(id);
    for (const [part, kind] of Object.entries(S.pal)) assert.ok(playable.has(kind), `${id} ${part}: ${kind}`);
    if (S.perc) for (const k of Object.values(S.perc.hits)) assert.ok(KINDS.hits.includes(k), `${id} hit ${k}`);
    if (S.color && S.color.kind !== 'voices') assert.ok(KINDS.colours.includes(S.color.kind), `${id} colour ${S.color.kind}`);
  }
});

test('the leitmotif fits its section and stays within two octaves', () => {
  for (const id of WORLDS) {
    const S = scoreFor(id), degs = S.motif.filter(([d]) => d !== null).map(([d]) => degreeSemis(S.scale, d));
    assert.ok(phraseBeats(S.motif) <= sectionBeats(S), `${id}: ${phraseBeats(S.motif)} beats in a ${sectionBeats(S)}-beat section`);
    assert.ok(Math.max(...degs) - Math.min(...degs) <= 24, `${id}: its range`);
  }
});

test('the father’s theme: the same shape in every world, in its own mode, in the first arc and every other one after', () => {
  const shape = FATHER_THEME.slice(1).map(([s], i) => sign(s - FATHER_THEME[i][0]));
  for (const id of WORLDS) {
    const S = scoreFor(id), F = fatherIn(S);
    const semis = F.map(([d]) => degreeSemis(S.scale, d));
    assert.deepEqual(semis.slice(1).map((s, i) => sign(s - semis[i])), shape, `${id}: ${semis}`);
    for (const [d] of F) assert.ok(S.scale.includes(((degreeSemis(S.scale, d) % 12) + 12) % 12));
    // it plays within the first arc, early (by the second section), and in one arc of every two
    const arc = sectionBeats(S) * 6, sung = (from, to) => events(id, to).filter((e) => e.beat >= from && e.layer === 'father' && e.kind === S.pal.father);
    const first = sung(0, arc);
    assert.deepEqual(first.map((e) => e.degree), F.map(([d]) => d), `${id} sings it in its first arc`);
    assert.ok(first[0].beat < sectionBeats(S) * 2);
    for (let a = 1; a < 9; a += 2) assert.ok(sung(a * arc, (a + 2) * arc).length >= F.length, `${id}: again by arc ${a + 2}`);
  }
  // at home it opens the world's own tune
  assert.deepEqual(SCORES.home.motif.slice(0, FATHER_THEME.length), fatherIn(SCORES.home));
});

test('determinism: the same world, beat and activity always play the same notes', () => {
  for (const id of WORLDS) {
    for (const act of [CALM_ACT, WALK, STILL]) assert.deepEqual(events(id, 300, act), events(id, 300, act));
    assert.deepEqual(sectionAt(id, 5000), sectionAt(id, 5000));
  }
});

test('not a loop: the arcs vary, and layers come and go by section', () => {
  for (const id of ORDER) {
    const S = scoreFor(id), kinds = [];
    for (let n = 0; n < 60; n++) kinds.push(sectionAt(id, n * sectionBeats(S)).kind);
    const arcs = new Set();
    for (let a = 0; a < 10; a++) arcs.add(kinds.slice(a * 6, a * 6 + 6).join());
    assert.ok(arcs.size >= 3, `${id}: ${arcs.size} kinds of arc`);
    // some sections are only the drone (and the colour): room to breathe
    assert.ok(kinds.includes('rest'));
  }
});

test('activity: walking brings the drums in, standing about and roofs take them out', () => {
  const perc = (id, act) => events(id, 600, act).filter((e) => e.layer === 'perc').length;
  for (const id of ORDER) {
    const S = scoreFor(id);
    if (!S.perc) { assert.equal(perc(id, WALK), 0, `${id} has no drums`); continue; }
    assert.ok(perc(id, WALK) > perc(id, CALM_ACT), `${id}: more drums walking`);
    assert.equal(perc(id, STILL), 0, `${id}: settled after standing a while`);
    assert.equal(perc(id, { ...WALK, indoor: 1 }), 0, `${id}: none indoors`);
  }
  // Vael and the cloud monastery stay without drums: wind and breath
  assert.equal(SCORES.arzach.perc, null);
  assert.equal(SCORES.arzach2.perc, null);
  // walking fills in the plucked figures too
  const pluck = (act) => events('desert', 600, act).filter((e) => e.layer === 'pluck').length;
  assert.ok(pluck(WALK) > pluck(CALM_ACT) * 1.4);
});

test('the chord follows the progression, bar by bar', () => {
  for (const id of WORLDS) {
    const S = scoreFor(id), per = S.meter * S.chordBars;
    for (let k = 0; k < S.prog.length * 2; k++) assert.equal(chordAt(S, k * per + 1), S.prog[k % S.prog.length]);
  }
});
