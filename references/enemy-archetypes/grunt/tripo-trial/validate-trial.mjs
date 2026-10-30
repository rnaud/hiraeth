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
// The flat export (flatten-tripo.mjs): no texture, the procedural grunt's zones, 1.3 m tall, and reproducible byte for byte.
{
  const flat=read('tripo-flat.glb'),zones=flat.json.meshes[0].primitives.map(p=>p.extras.zone);
  assert.ok(!flat.json.images&&!flat.json.textures,'Flat export carries no texture');
  assert.deepEqual(zones,['skin','cloth','leather','iron','bone','ink','eye'],'Flat export has every procedural zone, in order');
  assert.ok(flat.json.meshes[0].primitives.every(p=>!p.attributes.TEXCOORD_0&&p.attributes.COLOR_0!=null),'Flat zones: vertex colours, no UVs');
  const pos=flat.json.accessors[flat.json.meshes[0].primitives[0].attributes.POSITION];assert.ok(Math.abs(pos.max[1]-pos.min[1]-1.3)<1e-4,'Flat export is 1.3 m tall in its own frame');
  const report=JSON.parse(execFileSync(process.execPath,[dir+'audit.mjs',dir+'tripo-flat.glb'],{encoding:'utf8'}));
  assert.equal(report.triangles,31213);const skin=report.skins[0];assert.equal(skin.joints,54);assert.equal(skin.invalidWeights,0);assert.equal(skin.invalidJointIndices,0);
  assert.ok(skin.maxWeightError<1e-5);assert.ok(skin.bindMatrixConsistencyError<1e-5);
  const tmp=fs.mkdtempSync((process.env.TMPDIR??'/tmp/')+'tripo-flat-');
  try{execFileSync(process.execPath,[dir+'flatten-tripo.mjs',dir+'tripo-rigged.glb',tmp+'/again.glb']);assert.ok(fs.readFileSync(tmp+'/again.glb').equals(fs.readFileSync(dir+'tripo-flat.glb')),'flatten-tripo.mjs reproduces tripo-flat.glb')}finally{fs.rmSync(tmp,{recursive:true,force:true})}
  console.log(`tripo-flat.glb: zones ${zones.join(', ')}; no texture; 54 joints, consistent binding; reproduced byte for byte`);
}
// The LOD export (lod-tripo.mjs, round 3): 10–15k triangles, every zone, the flat export's skeleton, two nostrils on the
// Head, and reproducible byte for byte from tripo-flat.glb.
{
  const lod=read('tripo-lod.glb'),zones=lod.json.meshes[0].primitives.map(p=>p.extras.zone),x=lod.json.asset.extras;
  assert.deepEqual(zones,['skin','cloth','leather','iron','bone','ink','eye'],'LOD export keeps every zone, in order');
  assert.ok(x.triangles>=10000&&x.triangles<=15000,`LOD export in the 10–15k budget (${x.triangles})`);
  assert.equal(x.nostrils.length,2,'two nostrils');
  const report=JSON.parse(execFileSync(process.execPath,[dir+'audit.mjs',dir+'tripo-lod.glb'],{encoding:'utf8'}));
  assert.equal(report.triangles,x.triangles);const skin=report.skins[0];assert.equal(skin.joints,54);assert.equal(skin.invalidWeights,0);assert.equal(skin.invalidJointIndices,0);
  assert.ok(skin.maxWeightError<1e-5);assert.ok(skin.bindMatrixConsistencyError<1e-5);
  const tmp=fs.mkdtempSync((process.env.TMPDIR??'/tmp/')+'tripo-lod-');
  try{execFileSync(process.execPath,[dir+'lod-tripo.mjs',dir+'tripo-flat.glb',tmp+'/again.glb']);assert.ok(fs.readFileSync(tmp+'/again.glb').equals(fs.readFileSync(dir+'tripo-lod.glb')),'lod-tripo.mjs reproduces tripo-lod.glb')}finally{fs.rmSync(tmp,{recursive:true,force:true})}
  console.log(`tripo-lod.glb: ${x.triangles} triangles (from ${x.from}); zones ${zones.join(', ')}; 54 joints, consistent binding; reproduced byte for byte`);
}
