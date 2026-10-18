// Every house's keeper step and enter line point the way its guardian is (issue #478: the Clock-House said "Go down to
// what winds itself up" and the Undertower "Go down to the voice", "Somewhere far down", where both houses had been
// rebuilt with the guardian's hall on the top floor). Each house is built in its world and its arena's height compared
// with where you come in (the house's arrival): a line that says up needs the hall above, one that says down needs it
// not above. A house rebuilt again cannot leave its words behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Physics } from '../src/physics.js';

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
/** m: how far above the arrival a hall must be to be "up" (a step or a dais is not a floor). */
const FLOOR = 2;
const UP = /\b(go up|climb|high(?! note)|top|above|overhead|upstairs|belfry)\b/i;   // (a high note is not a floor)
const DOWN = /\b(go down|far down|below|beneath|deep|bottom|downstairs)\b/i;

/** The way a line points: 'up', 'down' or null (neither, or both). */
export function direction(line) {
  const u = UP.test(line ?? ''), d = DOWN.test(line ?? '');
  return u === d ? null : u ? 'up' : 'down';
}

test('the words: up and down are read from the line, not from its object', () => {
  assert.equal(direction('Climb to what winds itself up'), 'up');
  assert.equal(direction('Go down to what winds itself up'), 'down');
  assert.equal(direction('Go to what jams the engine'), null);
  assert.equal(direction('Somewhere far down, a voice says one word'), 'down');
  assert.equal(direction('Somewhere above, wings.'), 'up');
  assert.equal(direction('The walls hum one high note, very softly'), null);
});

test('each keeper step and enter line says up only where the guardian’s hall is above the door, down only where it is not', () => {
  const wrong = [];
  for (const [id, { def, words }] of Object.entries(TEMPLES)) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
    quiet(() => level.init?.(new Physics(scene, level.ground.heightAt ? level.ground : null)));
    const rt = templeOf(level, id), G = rt?.guardian;
    if (!G) continue;
    const rise = G.arena.center.y - rt.arrival.pos.y;
    for (const [what, line] of [['keeper', words.QUEST?.keeper], ['enterLine', def.enterLine]]) {
      const dir = direction(line);
      if (dir === 'up' && rise <= FLOOR) wrong.push(`${id} ${what} says up, the hall is ${rise.toFixed(1)} m from the door: “${line}”`);
      if (dir === 'down' && rise > FLOOR) wrong.push(`${id} ${what} says down, the hall is ${rise.toFixed(1)} m above the door: “${line}”`);
    }
    level.dispose?.();
  }
  assert.deepEqual(wrong, []);
});
