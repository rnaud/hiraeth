// The fights and the temples (issue #429): a fight, the foes, a makers' temple, a fight temple's first wave and its
// crowd, the engines' bundle held to the web's recorded stream beat by beat (tests/sequences-check.js). Their own file:
// tests/sequences-play.test.js had grown past a shard's 240 s a file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { checkSequences } from './sequences-check.js';
import { sequenceById } from '../engine/sequences.js';
import { FIGHTS } from './sequences-fights.js';

checkSequences((s) => FIGHTS.has(s.id));

test('every sequence moved here still exists', () => { for (const id of FIGHTS) assert.ok(sequenceById(id), id); });

test('crowd framing holds the excluded fourth foe without moving it or suppressing the hazard', () => {
  const foes = [1, 2, 3, 20].map(x => ({ alive: true, pos: new Vector3(x, 0, 0), stunned: 0 }));
  const far = foes[3].pos.clone(), hazard = { active: true };
  const G = { player: { pos: new Vector3() }, foes: { list: foes }, minigame: { session: { crowd(n) { assert.equal(n, 4); }, hazards: hazard } } };
  sequenceById('fight-crowd').beats.find(b => b.name === 'hemmed').act(G);
  assert.deepEqual(foes.map(f => f.stunned), [9, 9, 9, 9]);
  assert.ok(foes[3].pos.equals(far), 'the background foe keeps its layout position');
  assert.deepEqual(foes.slice(0, 3).map(f => f.pos.toArray()), [[.6, 0, .6], [-1.1, 0, .5], [.5, 0, -1.2]]);
  assert.equal(G.minigame.session.hazards, hazard, 'the intentional pool warning is not disabled');
});
