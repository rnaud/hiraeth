// The existing procedural sound assertions, without disk decoding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, variation, judge, envelope, kWeight, dB, ROLES, LIMITS } from '../scripts/sound-qc/lib.mjs';
import { ACTIONS, loadKit } from '../scripts/sound-qc/actions.mjs';
// Issue #531: the glove's modes each their own chirp, the gadgets' synths varied, their levels in band, judged as the
// QC judges them (the synth alone, what the engines play) against the procedural score round 1 balanced to.
test('the glove\'s modes sound apart, the gadgets\' synths vary, and their levels sit in their bands (issue #531)', async () => {
  await loadKit();
  const { renderAudio } = await import('../scripts/sound-qc/render-core.mjs');
  const R = await renderAudio();
  try {
    const sc = await R.score('desert', { secs: 20 });
    const lv = envelope(kWeight(sc.pcm), sc.rate).map(dB).sort((a, b) => a - b), ref = lv[Math.floor(0.95 * (lv.length - 1))];
    const ids = ['glove-fluid', 'glove-push', 'glove-stilling', 'gun-mode', 'glove-bloom', 'glove-tether', 'shoot-stun', 'push', 'hook-fire', 'hook-reel', 'hook-miss',
      'bomb-blast', 'magnet-grab', 'magnet-hold', 'magnet-shove', 'magnet-drop', 'springs-wind', 'springs-full', 'springs-stomp', 'lens-up', 'lens-down'];
    const m = {};
    for (const id of ids) {
      const a = ACTIONS.find((x) => x.id === id), takes = [];
      for (let k = 0; k < LIMITS.repeats; k++) { const r = await R.render((s) => a.play(s), { seed: 1000 + k * 37 }); takes.push(measure(r.pcm, r.rate, { bed: r.bed })); }
      m[id] = takes[0];
      const j = judge(takes[0], a.role, ref, { v: variation(takes), repeats: a.repeats });
      assert.equal(j.verdict, 'OK', `${id}: ${j.why.join('; ')}`);
    }
    const glove = ids.slice(0, 6);
    for (const [i, x] of glove.entries()) for (const y of glove.slice(i + 1)) {
      const a = m[x], b = m[y];
      const alike = Math.abs(a.centroid - b.centroid) / Math.max(a.centroid, b.centroid) < 0.05 && Math.abs(a.dur - b.dur) < 0.05 && Math.abs(a.rms - b.rms) < 1.5;
      assert.ok(!alike, `${x} and ${y} sound alike`);
    }
  } finally { R.close(); }
});
