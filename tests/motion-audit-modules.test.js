import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as facade from '../scripts/motion-audit/walk.mjs';
import * as procedural from '../scripts/motion-audit/walk-procedural.mjs';
import * as generated from '../scripts/motion-audit/walk-generated.mjs';

test('motion audit compatibility preserves function and shared registry identities', () => {
  assert.deepEqual(Object.keys(facade).sort(), [...Object.keys(procedural), ...Object.keys(generated)].sort());
  for (const [name, value] of Object.entries(procedural)) assert.equal(facade[name], value, name);
  assert.equal(facade.loadSkin, generated.loadSkin);
  assert.equal(facade.addGeneratedSkins, generated.addGeneratedSkins);
  assert.equal(facade.GUARDIANS, procedural.GUARDIANS);
  assert.deepEqual(Object.keys(procedural.GUARDIANS), ['keeper','sentinel','warden','foreman','gardener','sign','elder']);
});

test('procedural consumers have no generated IO dependency and generated loading shares the registry', () => {
  const core = readFileSync(new URL('../scripts/motion-audit/walk-procedural.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(core, /node:fs|GLTFLoader|walk-generated|from ['"]\.\/walk\.mjs/);
  const io = readFileSync(new URL('../scripts/motion-audit/walk-generated.mjs', import.meta.url), 'utf8');
  assert.match(io, /import \{ GUARDIANS, guardianSubject, boneLegs \} from '\.\/walk-procedural\.mjs'/);
  const actual = readFileSync(new URL('./motion-guardians.test.js', import.meta.url), 'utf8');
  assert.match(actual, /await addGeneratedSkins\(\)/, 'actual generated-skin gait coverage remains');
});
