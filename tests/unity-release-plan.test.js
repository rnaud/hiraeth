import test from 'node:test';
import assert from 'node:assert/strict';
import { relevantUnityInput, successfulPlayers, unityReleasePlan } from '../scripts/unity-release-plan.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const good=id=>({id,run_attempt:2,path:'.github/workflows/unity-android.yml',head_branch:'main',head_repository:{full_name:'owner/repo'},status:'completed',conclusion:'success',head_sha:id===1?A:B});
const paired=['android','linux'].map(name=>({name,status:'completed',conclusion:'success'}));
function fixture({runs=[good(1)],jobs=paired,changed=''}={}) {
 const requests=[],commands=[];const git=(...a)=>{commands.push(a);if(a[0]==='diff')return changed;if(a[0]==='merge-base')return '';return a[2].replace(/\^\{commit\}$/,'');};
 const request=async url=>{requests.push(url);return{ok:true,json:async()=>url.includes('/jobs?')?{jobs:typeof jobs==='function'?jobs(url):jobs}:{workflow_runs:runs}};};
 return {event:'schedule',head:C,repository:'owner/repo',runId:99,token:'fixture-only',git,request,requests,commands};
}
test('manual always builds without API; unsupported triggers reject',async()=>{
 const f=fixture();assert.equal((await unityReleasePlan({...f,event:'workflow_dispatch'})).build,true);assert.equal(f.requests.length,0);await assert.rejects(unityReleasePlan({...f,event:'push'}));
});
test('scheduled unchanged paired build skips; gameplay or package changes build',async()=>{
 const f=fixture({changed:'docs/README.md\0changelog-media/2.30/view.webp\0'});const p=await unityReleasePlan(f);assert.equal(p.build,false);assert.equal(p.baseline.runId,1);assert.equal(p.reason,'paired-players-current');assert.ok(f.requests.some(x=>x.includes('/attempts/2/jobs?')));
 for(const changed of ['src/game.js','public/models/actor.glb','engine/game.js','unity/Hiraeth/Assets/Host.cs','scripts/engine-bundle.mjs','data/characters/model.glb','package.json','package-lock.json','index.html','vite.config.js','.github/workflows/unity-android.yml']){assert.equal(relevantUnityInput(changed),true);assert.equal((await unityReleasePlan(fixture({changed:changed+'\0'}))).build,true);}
});
test('skip-only workflow success is ignored in favor of older real paired build',async()=>{
 const f=fixture({runs:[good(2),good(1)],jobs:url=>url.includes('/runs/2/')?paired.map(j=>({...j,conclusion:'skipped'})):paired,changed:'src/new.js\0'});const p=await unityReleasePlan(f);assert.equal(p.baseline.runId,1);assert.equal(p.build,true);
 assert.equal(successfulPlayers([paired[0]]),false);assert.equal(successfulPlayers([{...paired[0],conclusion:'failure'},paired[1]]),false);
});
test('no baseline builds; fork/feature/current/nonancestor runs cannot qualify',async()=>{
 const f=fixture({runs:[{...good(1),head_repository:{full_name:'fork/repo'}},{...good(2),head_branch:'feature'},{...good(99)}]});assert.equal((await unityReleasePlan(f)).reason,'no-successful-paired-player-baseline');assert.equal(f.requests.length,1);
 const g=fixture();g.git=(...a)=>{if(a[0]==='merge-base')throw Error('not ancestor');return C;};assert.equal((await unityReleasePlan(g)).build,true);
});
test('API outage, denied jobs or malformed results fail visibly rather than skip',async()=>{
 await assert.rejects(unityReleasePlan({...fixture(),request:async()=>{throw Error('offline')}}));
 await assert.rejects(unityReleasePlan({...fixture(),request:async()=>({ok:false,status:403})}),/API failed/);
 const f=fixture();await assert.rejects(unityReleasePlan({...f,request:async url=>url.includes('/jobs?')?{ok:false,status:503}:f.request(url)}),/API failed/);
 await assert.rejects(unityReleasePlan({...fixture(),request:async()=>({ok:true,json:async()=>({})})}),/Malformed/);
});
test('deleted and renamed input paths remain relevant; diff failures propagate',async()=>{
 const f=fixture({changed:'docs/old-model.glb\0public/deleted-or-moved.glb\0'});assert.deepEqual((await unityReleasePlan(f)).changed,['public/deleted-or-moved.glb']);assert.ok(f.commands.some(a=>a.includes('--no-renames')&&a.includes('-z')));
 const g=fixture();const git=g.git;g.git=(...a)=>{if(a[0]==='diff')throw Error('diff unavailable');return git(...a);};await assert.rejects(unityReleasePlan(g),/diff unavailable/);
});
