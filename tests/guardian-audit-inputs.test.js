import test from 'node:test';
import {readKeeperModelUrl} from '../scripts/model-audit/keeper-input.mjs';
import assert from 'node:assert/strict';
import {readdirSync,existsSync,readFileSync} from 'node:fs';
import {GUARDIAN_SKIN_INPUTS,readGuardianSkin,readGuardianModelUrl} from '../scripts/model-audit/guardian-inputs.mjs';

test('explicit audit inputs cover every generated guardian and preserve its exact bytes',()=>{
 const discovered=new Set();
 for(const dir of ['public','data'])for(const name of readdirSync(new URL(`../${dir}/guardians/`,import.meta.url))){
  const path=new URL(`../${dir}/guardians/${name}/model.glb`,import.meta.url);
  if(existsSync(path))discovered.add(name);
 }
 assert.deepEqual([...GUARDIAN_SKIN_INPUTS].sort(),[...discovered].sort(),'new skins need a literal input reader');
 for(const name of GUARDIAN_SKIN_INPUTS){
  const publicPath=new URL(`../public/guardians/${name}/model.glb`,import.meta.url);
  const path=existsSync(publicPath)?publicPath:new URL(`../data/guardians/${name}/model.glb`,import.meta.url);
  assert.deepEqual(readGuardianSkin(name),readFileSync(path));
  assert.deepEqual(readGuardianModelUrl(`guardians/${name}/model.glb`),readGuardianSkin(name));
 }
});
test('audit model readers reject arbitrary paths instead of silently widening dependencies',()=>{
 for(const name of ['unknown','__proto__','../src/hud.js'])assert.throws(()=>readGuardianSkin(name),/Undeclared/);
 for(const url of ['../src/hud.js','guardians/../../src/hud.js','file:///tmp/model.glb','guardians/new/model.glb','guardians/keeper-v1/model.glb?other'])assert.throws(()=>readGuardianModelUrl(url),/Undeclared/);
});

test('Keeper-only audit reader preserves its bytes and rejects sibling models',()=>{
 assert.deepEqual(readKeeperModelUrl('guardians/keeper-v1/model.glb'),readGuardianSkin('keeper-v1'));
 for(const url of ['guardians/elder-v1/model.glb','guardians/elder-v3/model.glb','../src/hud.js'])assert.throws(()=>readKeeperModelUrl(url),/Undeclared/);
});
