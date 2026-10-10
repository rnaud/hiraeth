// The Unity port's ship (unity/Memento/Assets/Memento/Runtime/ShipScene.cs, ShipTravel.cs) places the traveller and its
// cameras by the points the export writes from the web ship's interior (scripts/unity-export/export-world.mjs shipOut):
// every point the C# asks for by name is one the interior has, and the port's own test expects the bells there are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildShipModel } from '../src/ship/model.js';
import { THRUSTERS } from '../src/ship/exhaust.js';

const read = (p) => readFileSync(new URL(`../unity/Memento/Assets/Memento/${p}`, import.meta.url), 'utf8');
const scene = read('Runtime/ShipScene.cs') + read('Runtime/ShipTravel.cs');
const tests = read('Editor/Tests/WorldsTests.cs');
const points = buildShipModel().interior.points;

test('every ship point the Unity scenes read is one the interior exports', () => {
  const asked = new Set([...scene.matchAll(/\b(?:Pt|PtOr|Yaw)\("(\w+)"/g)].map((m) => m[1]));
  for (const k of ['cockpit', 'projector', 'table', 'tableFoot', 'threshold', 'aboard', 'wakeSit', 'wakeRoom', 'bunkStand']) assert.ok(asked.has(k), `the C# reads '${k}'`);
  for (const k of asked) assert.ok(k in points, `'${k}' is a point of src/ship/interior.js`);
});

test("the Unity test's points and bells are the web ship's", () => {
  const list = tests.match(/new\[\] \{ ("cockpit"[^}]*) \}/);
  assert.ok(list, 'WorldsTests lists the points');
  for (const [, k] of list[1].matchAll(/"(\w+)"/g)) assert.ok(k in points, `'${k}' is a point of src/ship/interior.js`);
  const bells = tests.match(/Assert\.AreEqual\((\d+), s\.L\("thrusters"\)\.Count/);
  assert.equal(Number(bells?.[1]), THRUSTERS.length, 'WorldsTests counts the bells exhaust.js has');
});
