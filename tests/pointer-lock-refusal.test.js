import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraRig } from '../src/player.js';

test('pointer-lock refusal is handled and leaves drag-to-look working', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldWarn = console.warn;
  try {
    for (const mode of ['reject', 'throw', 'legacy', 'resolve', 'absent']) {
      const local = {}, global = {}, warnings = [];
      globalThis.window = { addEventListener: (name, fn) => { global[name] = fn; } };
      globalThis.document = { pointerLockElement: null };
      console.warn = (...args) => warnings.push(args);
      const refusal = Object.assign(new Error('Browser refused capture'), { name: 'UnknownError' });
      const dom = { addEventListener: (name, fn) => { local[name] = fn; } };
      if (mode !== 'absent') dom.requestPointerLock = () => {
        if (mode === 'throw') throw refusal;
        if (mode === 'reject') return Promise.reject(refusal);
        return mode === 'resolve' ? Promise.resolve() : undefined;
      };
      const rig = new CameraRig(new THREE.PerspectiveCamera(), dom, {}), looks = [];
      rig.look = (x, y) => looks.push([x, y]);
      local.click(); local.click();
      // Node's test runner also fails this test on an unhandled rejected promise.
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(warnings.length, ['reject', 'throw'].includes(mode) ? 1 : 0, mode);
      if (warnings.length) assert.match(warnings[0][0], /drag to look/);
      global.mousemove({ movementX: 2, movementY: 3 });
      assert.equal(looks.length, 0, 'unlocked hover does not turn');
      local.mousedown(); global.mousemove({ movementX: 4, movementY: -2 }); global.mouseup();
      global.mousemove({ movementX: 8, movementY: 8 });
      assert.deepEqual(looks, [[4, -2]], 'drag works after refusal and ends on release');
      document.pointerLockElement = dom;
      global.mousemove({ movementX: 1, movementY: 1 });
      assert.deepEqual(looks.at(-1), [1, 1], 'successful capture still turns without dragging');
    }
  } finally {
    globalThis.window = oldWindow; globalThis.document = oldDocument; console.warn = oldWarn;
  }
});
