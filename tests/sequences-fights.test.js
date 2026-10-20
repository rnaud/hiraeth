// The fights and the temples (issue #429): a fight, the foes, a makers' temple, a fight temple's first wave and its
// crowd, the engines' bundle held to the web's recorded stream beat by beat (tests/sequences-check.js). Their own file:
// tests/sequences-play.test.js had grown past a shard's 240 s a file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequences } from './sequences-check.js';
import { sequenceById } from '../engine/sequences.js';
import { FIGHTS } from './sequences-fights.js';

checkSequences((s) => FIGHTS.has(s.id));

test('every sequence moved here still exists', () => { for (const id of FIGHTS) assert.ok(sequenceById(id), id); });
