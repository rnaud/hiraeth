// The key counter's data and SVG contract, independent of whole-world chest/audio fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { keysHud } from '../src/hud-state.js';
import { KEY_SVG, GREAT_KEY_SVG } from '../src/hud-view.js';
import { screen } from '../src/platform.js';

test('the counter: hud data for an engine, and its icons inked', () => {
  assert.equal(keysHud({}), null);
  assert.deepEqual(keysHud({ inside: true, small: 2.7, big: 1 }), { small: 2, big: true });
  assert.deepEqual(keysHud({ inside: true, small: -1 }), { small: 0, big: false });
  assert.ok('keys' in screen.state, 'platform.js screen carries it');
  for (const svg of [KEY_SVG, GREAT_KEY_SVG]) assert.match(svg, /^<svg viewBox="[\d .]+" aria-hidden="true">.*stroke="#2b211f".*<\/svg>$/);
});

