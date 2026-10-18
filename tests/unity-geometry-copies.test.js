// The Unity bridge reads a geometry's bytes where they lie (issue #468): BridgeRenderer.Geometry and FaceKeys take the
// words and floats as spans over the byte[] the script handed over, not two copies of it a geometry (a foe's spawn
// came with 14 MB of geometry, and its two copies were a good share of the frame's 21-23 managed collections).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs', import.meta.url), 'utf8');
/** A method's body: from its signature to the next method at the same indent. */
const body = (sig) => { const i = src.indexOf(sig); assert.ok(i >= 0, sig); const j = src.indexOf('\n        public ', i + sig.length); return src.slice(i, j < 0 ? undefined : j); };

test('a geometry and a face\'s keys are read as spans over their bytes, never copied', () => {
  for (const sig of ['public void Geometry(string key, byte[] b, int count)', 'public void FaceKeys(string key, byte[] b, int count)']) {
    const b = body(sig);
    assert.match(b, /MemoryMarshal\.Cast<byte, uint>/, sig);
    assert.match(b, /MemoryMarshal\.Cast<byte, float>/, sig);
    assert.doesNotMatch(b, /new (uint|float)\[count \/ 4\]|new float\[u\.Length\]/, `${sig}: no copy of the bytes`);
  }
});
