// The public command modules still expose the same implementations; real CLI smoke lives here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tempDir,removeTemp} from '../scripts/temp-dirs.mjs';

test('score and GLB public modules re-export the same core implementations',async()=>{
 const pairs=[
  [await import('../scripts/score-features.mjs'),await import('../scripts/score-features-core.mjs')],
  [await import('../scripts/tripo/slim-traveller.mjs'),await import('../scripts/tripo/slim-traveller-core.mjs')],
  [await import('../scripts/tripo/slim-father.mjs'),await import('../scripts/tripo/slim-father-core.mjs')],
 ];
 for(const [facade,core] of pairs){assert.deepEqual(Object.keys(facade),Object.keys(core));for(const key of Object.keys(core))assert.strictEqual(facade[key],core[key],key);}
});

test('audio facade and synthesis core produce identical PCM with the same seed',async()=>{
 const {renderer}=await import('../scripts/sound-qc/render.mjs');
 const {renderAudio}=await import('../scripts/sound-qc/render-core.mjs');
 const facade=await renderer({samples:false}), core=await renderAudio();
 try{
  assert.equal(facade.samples,false);assert.equal(core.samples,false);
  const a=await facade.render(s=>s.jump(),{secs:0.2,warm:0.1,seed:71});
  const b=await core.render(s=>s.jump(),{secs:0.2,warm:0.1,seed:71});
  assert.deepEqual(a.pcm,b.pcm);assert.deepEqual(a.bed,b.bed);assert.equal(a.rate,b.rate);
  const x=await facade.score('desert',{secs:0.2,warm:0.1,seed:83});
  const y=await core.score('desert',{secs:0.2,warm:0.1,seed:83});
  assert.deepEqual(x.pcm,y.pcm);assert.equal(x.rate,y.rate);
 }finally{facade.close();core.close();}
});

test('score CLI still accepts an explicit module and IDs and prints their nearest pair',()=>{
 const out=execFileSync(process.execPath,['scripts/score-features.mjs'],{encoding:'utf8',env:{...process.env,SCORE_MODULE:resolve('src/score.js'),IDS:'desert,bazaar'},timeout:30000});
 assert.match(out,/desert/);assert.match(out,/bazaar/);assert.match(out,/nearest pairs:/);assert.match(out,/desert ~ bazaar/);
});

test('level-design CLI writes the requested world report, maps and views',()=>{
 const out=tempDir('level-cli-');
 try{
  const log=execFileSync(process.execPath,['scripts/level-design/audit.mjs',out,'--worlds','underwater','--cell','8'],{encoding:'utf8',timeout:180000});
  const report=JSON.parse(readFileSync(join(out,'report.json'),'utf8'));
  assert.deepEqual(report.worlds.map(w=>w.id),['underwater']);
  assert.deepEqual(readdirSync(out).sort(),['report.json','underwater-map.png','underwater-map.svg','views.json']);
  assert.ok(JSON.parse(readFileSync(join(out,'views.json'),'utf8')).views.length);
  assert.equal(readFileSync(join(out,'underwater-map.png')).subarray(1,4).toString(),'PNG');
  assert.match(readFileSync(join(out,'underwater-map.svg'),'utf8'),/<svg/);
  assert.match(log,/scores \(1-5\)/);assert.ok(log.includes(out));
 }finally{removeTemp(out);}
});
