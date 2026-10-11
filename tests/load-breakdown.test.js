import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phasesOf, firstPlayable, quantile } from '../scripts/load-breakdown.mjs';

test('a load split by kind of work: each step to its kind, the rest of a stage to other', () => {
  const log = [
    { stage: 'start', ms: 30, steps: [] },
    { stage: 'sketching the desert…', ms: 1000, steps: [['world', 900], ['openings', 20]] },
    { stage: 'inking the collisions…', ms: 300, steps: [['bake', 120], ['level init', 30], ['water', 2], ['tiling', 70]] },
    { stage: 'waking the people…', ms: 700, steps: [['assets wait', 20], ['traveller', 290], ['npcs', 60], ['flora', 60], ['story', 150]] },
    { stage: 'mixing the inks…', ms: 900, steps: [['near detail', 40], ['batches', 300], ['surfaces', 220], ['water', 20], ['passage', 240]] },
  ];
  const p = phasesOf(log, 200, 200 + 2930 + 100);
  assert.equal(p.modules, 200);
  assert.equal(p.assets, 20);
  assert.equal(p.world, 900 + 20 + 2 + 70 + 60 + 40 + 300, 'the world water of the collision stage; flora; the near detail; the batches');
  assert.equal(p.collision, 150);
  assert.equal(p.characters, 350);
  assert.equal(p.shaders, 240, "the inks' water is the water's shader");
  assert.equal(p['gpu warm-up'], 240);
  assert.equal(p.other, 30 + 80 + 78 + 120 + 150 + 80, 'the stages beyond their steps, the story');
  assert.equal(p['first frame'], 100);
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  assert.equal(sum, 200 + 2930 + 100, 'it adds up to the first frame');
});

test('every step main.js names has a kind', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const steps = [...src.matchAll(/setStep\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(steps.length > 20);
  const log = [{ stage: 'x', ms: 0, steps: steps.map((s) => [s, 1]) }];
  const p = phasesOf(log, 0, 0);
  // (only the people's own story, sound and the rest of the stage go to other)
  assert.ok(p.other <= 3, `steps without a kind: ${p.other}`);
});

test('the first playable frame: ten frames in a row under 50 ms apart', () => {
  const t = [0, 100, 300, 316, 333, 350, 366, 383, 400, 416, 433, 450, 466, 483, 500];
  assert.equal(firstPlayable(t, 0), 300);
  assert.equal(firstPlayable([0, 100, 200], 0), null);
  assert.equal(quantile([5, 1, 3, 2, 4], 0.5), 3);
  assert.equal(quantile([], 0.99), 0);
});
