// How alike the worlds' procedural scores are (issue #318: "the procedural score sounds too similar level to level").
// A feature vector per score from what it plays (src/score.js scoreBeat, walking and standing about) and from what it
// sounds like (rendered offline on the engines' in-memory Web Audio, engine/webaudio.js), and a distance between two
// scores. tests/score-distinct.test.js holds every pair of worlds apart with it.
//
//   node scripts/score-features.mjs            the nearest pairs, and each score's features
//   node scripts/score-features.mjs --render   with the rendered features too (about a second a score)
//
// The parts of the distance (each 0..1, then weighted, DISTANCE_WEIGHTS):
//   tempo     beats a minute, 12 apart is all the way
//   metre     beats a bar: the same or not
//   harmony   the mode's notes (pitch classes over the tonic) and the key: what it is in
//   timbre    the instruments: drone, pad, bass, pluck, lead, the father's voice, the drums' hits, the colour
//   density   notes a second (walking), on a log scale: a doubling is half the way
//   register  where the tune and the figures sit (mean pitch of lead and pluck notes), an octave is all the way
//   rhythm    where in the beat the notes and hits fall (12 bins: on the beat, swung, triplets, sixteenths)
//   drums     hits a second walking

import { pathToFileURL } from 'node:url';

export const DISTANCE_WEIGHTS = { tempo: 1, metre: 0.5, harmony: 1, timbre: 2, density: 0.75, register: 0.75, rhythm: 1, drums: 0.75 };

const midi = (f) => 69 + 12 * Math.log2(f / 440);

/** What a score plays: { tempo, meter, pcs (pitch classes over the tonic), key (midi pitch class of the root), timbre (Set), density, register, rhythm (12 bins), drums }. */
export function scoreFeatures(score, id, { beats = 512 } = {}) {
  const { SCORES, scoreFor, scoreBeat, scoreFreq, CALM_ACT } = score;
  const S = scoreFor(id);
  const walk = { ...CALM_ACT, move: 1 };
  const P = S.pal;
  const timbre = new Set([`drone:${P.drone}`, `pad:${P.pad}`, `pluck:${P.pluck}`, `lead:${P.lead}`, `father:${P.father}`, `bass:${P.bass}${S.walk ? ':walk' : ''}`]);
  for (const h of Object.values(S.perc?.hits ?? {})) timbre.add(`hit:${h}`);
  if (S.color) timbre.add(`colour:${S.color.kind}`);
  let notes = 0, hits = 0, pitch = 0, pitched = 0;
  const rhythm = new Array(12).fill(0);
  for (let b = 0; b < beats; b++) {
    for (const e of scoreBeat(id, b, walk)) {
      if (e.layer === 'drone' || e.layer === 'pad') continue;
      const frac = ((e.at % 1) + 1) % 1;
      rhythm[Math.round(frac * 12) % 12]++;
      if (e.layer === 'perc') { hits++; continue; }
      notes++;
      if ((e.layer === 'lead' || e.layer === 'pluck') && e.degree !== undefined) { pitch += midi(scoreFreq(S, e.degree, e.octave ?? 0)); pitched++; }
    }
  }
  const secs = beats * 60 / S.tempo, total = rhythm.reduce((a, b) => a + b, 0) || 1;
  return {
    id, tempo: S.tempo, meter: S.meter, pcs: new Set(S.scale.map((s) => Math.round(s * 2) / 2)), key: ((Math.round(midi(S.root)) % 12) + 12) % 12,
    timbre, density: notes / secs, register: pitched ? pitch / pitched : 60, rhythm: rhythm.map((n) => n / total), drums: hits / secs,
    known: !!SCORES[id],
  };
}

const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

/** The parts of the distance between two scores' features (each 0..1). */
export function distanceParts(a, b) {
  const keyStep = Math.min(Math.abs(a.key - b.key), 12 - Math.abs(a.key - b.key));
  return {
    tempo: Math.min(1, Math.abs(a.tempo - b.tempo) / 12),
    metre: a.meter === b.meter ? 0 : 1,
    harmony: Math.min(1, (1 - jaccard(a.pcs, b.pcs)) * 1.5 + (keyStep ? 0.25 : 0)),
    timbre: 1 - jaccard(a.timbre, b.timbre),
    density: Math.min(1, Math.abs(Math.log2((a.density + 0.05) / (b.density + 0.05))) / 2),
    register: Math.min(1, Math.abs(a.register - b.register) / 12),
    rhythm: Math.min(1, a.rhythm.reduce((s, v, i) => s + Math.abs(v - b.rhythm[i]), 0) / 2 * 2),
    drums: Math.min(1, Math.abs(a.drums - b.drums) / 2),
  };
}

/** The distance between two scores: the weighted parts, summed. */
export function scoreDistance(a, b) {
  const p = distanceParts(a, b);
  return Object.entries(DISTANCE_WEIGHTS).reduce((s, [k, w]) => s + w * p[k], 0);
}

/** Every pair, nearest first: [{ a, b, d, parts }]. */
export function nearestPairs(feats) {
  const out = [];
  for (let i = 0; i < feats.length; i++) for (let j = i + 1; j < feats.length; j++) out.push({ a: feats[i].id, b: feats[j].id, d: scoreDistance(feats[i], feats[j]), parts: distanceParts(feats[i], feats[j]) });
  return out.sort((x, y) => x.d - y.d);
}

/**
 * A score as it sounds: `secs` rendered offline on engine/webaudio.js's context, walking from the first second, the
 * music alone (no ambience, no effects). { rms (dB), low, mid, high (the energy's share below 300 Hz, 300-2000 Hz,
 * above), onsets (a second, from the flux above 300 Hz), peak }. Needs the page globals (window) a Sound expects.
 */
export async function renderFeatures(id, { secs = 10, sampleRate = 22050 } = {}) {
  const G = globalThis;
  G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
  const { installAudio, AudioContext } = await import('../engine/webaudio.js');
  if (G.AudioContext !== AudioContext) { delete G.AudioContext; installAudio(G, { sampleRate }); }
  const { Sound } = await import('../src/audio.js');
  const s = new Sound(id, { score: false, muted: false, autoStart: false });
  s.start(); s._unlisten?.();
  s.score = true; s.voice.ambience = 'none'; s.fx.gain.value = 0;
  const sr = s.ctx.sampleRate, block = 128 * Math.round(sr * 0.1 / 128), out = new Float32Array(Math.ceil(secs / (block / sr)) * block);
  const CALM = { gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0, flying: false, indoor: 0, night: false };
  let n = 0;
  for (let t = 0; n < out.length; t += block / sr) {
    s.update({ ...CALM, speed: t < 1 ? 0 : 4.5 }); s.schedule();
    const pcm = s.ctx.render(block);
    for (let i = 0; i < block; i++) out[n++] = (pcm[2 * i] + pcm[2 * i + 1]) / 2;
  }
  clearInterval(s.scheduler); clearTimeout(s._preload);
  try { s.dispose?.(); } catch { /* the in-memory context */ }
  const a1 = Math.exp(-2 * Math.PI * 300 / sr), a2 = Math.exp(-2 * Math.PI * 2000 / sr), F = 512;
  let lp1 = 0, lp2 = 0, el = 0, em = 0, eh = 0, peak = 0, fe = 0;
  const flux = [];
  for (let i = 0; i < n; i++) {
    const x = out[i]; lp1 = a1 * lp1 + (1 - a1) * x; lp2 = a2 * lp2 + (1 - a2) * x;
    const mi = lp2 - lp1, hi = x - lp2;
    el += lp1 * lp1; em += mi * mi; eh += hi * hi; peak = Math.max(peak, Math.abs(x));
    fe += (x - lp1) * (x - lp1);
    if (i % F === F - 1) { flux.push(fe); fe = 0; }
  }
  const tot = el + em + eh || 1, mean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
  let onsets = 0;
  for (let i = 3; i < flux.length; i++) { const before = (flux[i - 1] + flux[i - 2] + flux[i - 3]) / 3; if (flux[i] > 1.6 * before && flux[i] > 0.3 * mean) onsets++; }
  let sq = 0; for (let i = 0; i < n; i++) sq += out[i] * out[i];
  return { rms: 20 * Math.log10(Math.sqrt(sq / n) + 1e-9), low: el / tot, mid: em / tot, high: eh / tot, onsets: onsets / (n / sr), peak };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const score = await import(process.env.SCORE_MODULE ? pathToFileURL(process.env.SCORE_MODULE).href : '../src/score.js');
  const ids = process.env.IDS ? process.env.IDS.split(',') : Object.keys(score.SCORES);
  const feats = ids.map((id) => scoreFeatures(score, id));
  for (const f of feats) console.log(`${f.id.padEnd(15)} ${String(f.tempo).padStart(3)} bpm ${f.meter}/x  ${f.density.toFixed(2)} notes/s  ${f.drums.toFixed(2)} hits/s  register ${f.register.toFixed(1)}  ${[...f.timbre].join(' ')}`);
  console.log('\nnearest pairs:');
  for (const p of nearestPairs(feats).slice(0, 12)) console.log(`${p.d.toFixed(2)}  ${p.a} ~ ${p.b}   ${Object.entries(p.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}`);
  if (process.argv.includes('--render')) {
    console.log('\nrendered (10 s walking, music only):');
    for (const id of ids) { const r = await renderFeatures(id); console.log(`${id.padEnd(15)} ${r.rms.toFixed(1)} dB  peak ${r.peak.toFixed(2)}  low ${r.low.toFixed(2)} mid ${r.mid.toFixed(2)} high ${r.high.toFixed(3)}  ${r.onsets.toFixed(2)} onsets/s`); }
  }
  process.exit(0);
}
