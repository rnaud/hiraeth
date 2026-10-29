import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
function read(file){const bytes=fs.readFileSync(dir+file),n=bytes.readUInt32LE(12);return{json:JSON.parse(bytes.toString('utf8',20,20+n)),bin:bytes.subarray(28+n)}}
const source=read('source-z-forward.glb'),custom=read('custom-rigged.glb');
assert.deepEqual(custom.bin.subarray(0,source.bin.length),source.bin,'Custom rig must preserve every source binary byte');
assert.deepEqual(custom.json.accessors.slice(0,source.json.accessors.length),source.json.accessors,'Original geometry accessors unchanged');
assert.deepEqual(custom.json.materials,source.json.materials,'Source material preserved');
assert.deepEqual(custom.json.images,source.json.images,'Source texture preserved');
for(const file of ['rigged.glb','tripo-rigged.glb','custom-rigged.glb']){
  const report=JSON.parse(execFileSync(process.execPath,[dir+'audit.mjs',dir+file],{encoding:'utf8'}));
  assert.equal(report.triangles,31213);assert.equal(report.skins.length,1);
  const skin=report.skins[0];assert.equal(skin.invalidWeights,0);assert.equal(skin.invalidJointIndices,0);
  assert.ok(skin.maxWeightError<1e-5);assert.ok(skin.bindMatrixConsistencyError<1e-5);
  console.log(`${file}: ${skin.joints} joints, normalized weights, valid indices and consistent rest binding`);
}
console.log('Custom source geometry / UV / normal / texture bytes unchanged.');
