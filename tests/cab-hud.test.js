// Cab cue formatting does not need two constructed city worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cueText } from '../src/hud-state.js';

test('the cue: no button hints in a cab (its dash asks where to by itself)', () => {
  assert.equal(cueText({ ride: 'taxi', rideFor: 0 }), '');
  assert.equal(cueText({ ride: 'taxi', rideFor: 0, controller: true }), '');
});

