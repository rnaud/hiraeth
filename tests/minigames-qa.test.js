// The QA pass over the eleven games (docs/systems/minigames.md): what every game shares (its controls on the
// start card for a pad, the keys and a touch screen; its place in the Games row, with its best), and the fixes
// of the pass: a run's things let go on Retry, Ink tide's longer blade drawn longer, the gallery's bells in
// reach, the sketch hunt's readout seeing the crowd in the way.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { collectGames } from '../src/minigames/index.js';
import { controlsFor } from '../src/minigames/kit/flow.js';
import { disposeTree } from '../src/minigames/kit/dispose.js';
import { gamesRow, gameBest } from '../src/world-picker.js';
import { BLADE, bladeLength, bladeScale } from '../src/fluid-blade.js';
import { boonTunings } from '../src/minigames/waves.js';
import { BELLS, STAND } from '../src/minigames/gallery.js';
import { crowdInWay, BODY } from '../src/minigames/framing.js';

const IDS = ['ski', 'platformer', 'canyon', 'fishing', 'rings', 'wingdrop', 'gallery', 'waves', 'drums', 'sketchhunt', 'pirates'];
const modules = Object.fromEntries(await Promise.all(IDS.map(async (id) => [`./${id}.js`, await import(`../src/minigames/${id}.js`)])));
const GAMES = collectGames(modules, (m) => { throw new Error(m); });

test('all eleven games, each in its own place in the Games row', () => {
  assert.deepEqual(GAMES.map((g) => g.id), IDS, 'the row in the order of the docs');
  assert.equal(new Set(GAMES.map((g) => g.order)).size, GAMES.length, 'no two games share an order');
});

test('every start card lists the controls for a pad (Xbox / PlayStation form), the keys and a touch screen', () => {
  const KEYS = /\b(Space|Shift|Esc|Enter|Ctrl|Alt|Tab|WASD|W A S D|mouse|Click|Wheel)\b/i;
  const PAD = /\b(RT|LT|RB|LB) \/ (R2|L2|R1|L1)\b|\b[ABXY] \/ [×○□△]|\bLeft stick\b|\bRight stick\b|\bMenu\b|\bR3\b|\bLB \/ RB\b/;
  for (const g of GAMES) {
    const pad = controlsFor(g, 'pad'), keys = controlsFor(g, 'keys'), touch = g.controls?.touch;
    assert.ok(pad.length && keys.length && touch?.length, `${g.id}: pad, keys and touch rows`);
    for (const [k] of pad) assert.ok(!KEYS.test(k), `${g.id}: a key on the pad's card: "${k}"`);
    assert.ok(pad.some(([k]) => PAD.test(k)), `${g.id}: the pad's buttons named as on the pad`);
    for (const [k] of keys) assert.ok(!/\b(RT|LT|RB|LB) \/|[×○□△]/.test(k), `${g.id}: a pad button on the keys' card: "${k}"`);
    assert.ok(pad.some(([, v]) => /pause/.test(v)) && keys.some(([, v]) => /pause/.test(v)), `${g.id}: how to pause`);
  }
});

test('the Games row: every game, with its best when there is one', () => {
  const flags = { 'minigame.ski.best': 52.31, 'minigame.platformer.best': 412 };
  const state = { flag: (k) => flags[k] };
  const row = gamesRow(GAMES, state);
  for (const g of GAMES) assert.ok(row.includes(`?game=${g.id}`) && row.includes(g.name), g.id);
  assert.match(row, /Dune skiing<small class="best">best 52\.31<\/small>/);
  assert.match(row, /Sky steps<small class="best">best 412 pts<\/small>/);
  assert.equal(gameBest(GAMES.find((g) => g.id === 'rings'), state), '', 'no best yet: nothing under it');
  assert.ok(!gamesRow(GAMES).includes('class="best"'), 'no save: no bests');
});

test('disposeTree: out of the scene, every geometry under it (and an instanced mesh) let go', () => {
  const scene = new THREE.Scene(), g = new THREE.Group();
  const geos = [new THREE.BoxGeometry(), new THREE.SphereGeometry()], gone = new Set();
  for (const q of geos) q.addEventListener('dispose', () => gone.add(q));
  g.add(new THREE.Mesh(geos[0]), new THREE.Group().add(new THREE.Mesh(geos[1])));
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
  let instGone = false; inst.addEventListener('dispose', () => { instGone = true; });
  scene.add(g, inst);
  disposeTree(g, inst, null);
  assert.equal(scene.children.length, 0);
  assert.equal(gone.size, 2);
  assert.ok(instGone);
});

test('Ink tide\'s longer blade: drawn longer, not only cutting further', () => {
  const was = BLADE.length;
  try {
    const built = BLADE.length;
    assert.equal(bladeScale(undefined, built), 1);
    const T = boonTunings({ reach: 1 });
    BLADE.length = T.length;   // (as the game tunes it: kit/onfoot.js tune)
    assert.ok(bladeLength(undefined) > built * 1.1, 'the blade that cuts is longer');
    assert.ok(Math.abs(bladeScale(undefined, built) - T.length / built) < 1e-9 && bladeScale(undefined, built) > 1.1, 'and the mesh is stretched to it');
  } finally { BLADE.length = was; }
});

test('the gallery\'s bells hang down into the view over the rails, not up by the valance', () => {
  for (const B of BELLS) {
    const y = B.top - B.len;   // (the bell at rest)
    assert.ok(y < 4.6 && y > 3.2, `a bell at ${y.toFixed(2)} m`);
    const up = Math.atan2(y - 1.6, STAND.at.z - B.z) * 180 / Math.PI;
    assert.ok(up < 22, `${up.toFixed(0)}° up from the eye`);
  }
});

test('the sketch hunt: someone between you and the subject is in the way; beside the line, behind it, or sitting low under it is not', () => {
  const eye = { x: 0, y: 1.6, z: 0 }, dir = { x: 0, y: 0, z: 1 }, near = 10;
  const at = (x, z, extra = {}) => [{ pos: new THREE.Vector3(x, 0, z), scale: 1, ...extra }];
  assert.equal(crowdInWay(at(0, 5), eye, dir, near), true, 'in front');
  assert.equal(crowdInWay(at(1, 5), eye, dir, near), false, 'a metre to the side');
  assert.equal(crowdInWay(at(0, 12), eye, dir, near), false, 'behind the subject');
  assert.equal(crowdInWay(at(0, 0.2), eye, dir, near), false, 'yourself (closer than BODY.from)');
  assert.equal(crowdInWay(at(0, 5, { tall: 1.05 }), eye, dir, near), false, 'sitting on the kerb, under the line at eye height');
  assert.equal(crowdInWay(at(0, 5, { _gone: true }), eye, dir, near), false);
  // looking down at someone over a person in the way: the line passes over their head
  const down = { x: 0, y: -0.3, z: 0.954 };
  assert.equal(crowdInWay(at(0, 2), eye, down, near), true, 'close, the line still through them');
  assert.ok(BODY.r > 0.2 && BODY.r < 0.4);
});
