// perf.js cacheUniformArrays: a uniform array (the light list, a palette) is not sent again to a program
// when its values haven't changed (three.js caches single uniforms, not arrays: docs/systems/performance.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheUniformArrays, CACHED_UNIFORM_ARRAYS } from '../src/perf.js';

const fakeGl = () => {
  const sent = [];
  const gl = {};
  for (const n of CACHED_UNIFORM_ARRAYS) gl[n] = function (loc, data, ...rest) { sent.push([n, loc, Array.from(data ?? []), rest]); };
  return { gl, sent };
};

test('the same values to the same location are sent once; a change, another location or another program sends', () => {
  const { gl, sent } = fakeGl();
  cacheUniformArrays(gl);
  const a = {}, b = {};   // (uniform locations: one per program and uniform)
  const pool = new Float32Array(4);   // (three.js flattens into a reused array)
  pool.set([1, 2, 3, 4]); gl.uniform4fv(a, pool);
  pool.set([1, 2, 3, 4]); gl.uniform4fv(a, pool);
  assert.equal(sent.length, 1, 'unchanged: not sent again');
  gl.uniform4fv(b, pool);
  assert.equal(sent.length, 2, 'another program\'s location');
  pool[2] = 9; gl.uniform4fv(a, pool);
  assert.deepEqual(sent[2][2], [1, 2, 9, 4], 'a changed value is sent');
  gl.uniform4fv(a, pool);
  assert.equal(sent.length, 3);
  gl.uniform4fv(a, new Float32Array(8));
  assert.equal(sent.length, 4, 'another length');
});

test('any other form goes through and forgets the location', () => {
  const { gl, sent } = fakeGl();
  cacheUniformArrays(gl);
  const a = {}, v = new Float32Array([1, 2, 3]);
  gl.uniform3fv(a, v);
  gl.uniform3fv(a, v, 0, 3);   // (with an offset and length)
  gl.uniform3fv(a, v);
  assert.equal(sent.length, 3, 'after a call it can\'t follow, the next plain one is sent');
  gl.uniform3fv(null, v);
  assert.equal(sent.length, 4);
  assert.equal(cacheUniformArrays(gl), gl, 'wrapping twice is a no-op');
  gl.uniform3fv(a, v);
  assert.equal(sent.length, 4);
});
