import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { publishPackage, packageUrl, fetchRelease } from '../scripts/publish-steam-deck.mjs';
const commit='a'.repeat(40), digest=b=>createHash('sha256').update(b).digest('hex');
function fixture(options={}) {
  const data=Buffer.from('actual test archive bytes'),manifest={build:123001,version:'2.07',sha256:digest(data),url:packageUrl(123001)};
  const files=[{name:'hiraeth-steam-deck-123001.tar.gz',data},{name:'steam-deck.json',data:Buffer.from(JSON.stringify(manifest))},{name:'install-hiraeth.py',data:Buffer.from('installer')}];
  const legacy={assets:[{name:'steam-deck.json'},{name:'install-hiraeth.py'}]},events=[],bytes=new Map();let release;
  const api={async tagCommit(){return options.tagCollision?'b'.repeat(40):release&&!release.draft?commit:null;},async get(tag){events.push(['get',tag]);return tag==='steam-deck'?legacy:release;},async create(tag,sha,body){events.push(['create',tag,sha]);return release={tag_name:tag,draft:true,prerelease:true,target_commitish:sha,body,assets:[]};},async upload(tag,f){events.push(['upload',tag,f.name]);bytes.set(f.name,f.data);release.assets.push({name:f.name,id:f.name,size:f.data.length,state:'uploaded'});},async download(a){events.push(['verify',a.name]);return options.corrupt?Buffer.from('bad'):bytes.get(a.name);},async publish(tag){events.push(['publish',tag]);if(options.publishFails)throw Error('transient publish failure');if(!options.stuckDraft)release.draft=false;if(options.swapAfterPublish)release.assets[0]={...release.assets[0],id:'swapped'};}};
  return {api,manifest,files,commit,events,legacy,get release(){return release;}};
}
test('package verifies all bytes before publishing, without mutating full legacy release',async()=>{
 const f=fixture(),legacy=JSON.stringify(f.legacy);await publishPackage(f);
 assert.equal(JSON.stringify(f.legacy),legacy);assert.equal(f.events.filter(e=>e[0]==='verify').length,3);
 assert.ok(f.events.findIndex(e=>e[0]==='publish')>f.events.map(e=>e[0]).lastIndexOf('verify'));assert.ok(f.events.filter(e=>['create','upload','publish'].includes(e[0])).every(e=>e[1]==='steam-deck-123001'));
});
test('bad remote bytes leave draft unpublished and legacy feed untouched',async()=>{const f=fixture({corrupt:true});await assert.rejects(publishPackage(f),/checksum/);assert.equal(f.release.draft,true);assert.ok(!f.events.some(e=>e[0]==='publish'));});
test('retry resumes verified draft, and published retries never upload or republish',async()=>{
 const opts={publishFails:true},f=fixture(opts);await assert.rejects(publishPackage(f),/transient/);opts.publishFails=false;f.events.length=0;await publishPackage(f);assert.ok(!f.events.some(e=>e[0]==='upload'));f.events.length=0;await publishPackage(f);assert.ok(!f.events.some(e=>['upload','publish','create'].includes(e[0])));
});
test('missing legacy channel and wrong commit provenance fail closed',async()=>{const f=fixture();f.legacy.assets=[];await assert.rejects(publishPackage(f),/Legacy/);assert.ok(!f.events.some(e=>e[0]==='create'));const g=fixture();await publishPackage(g);g.release.body='wrong';await assert.rejects(publishPackage(g),/provenance/);});
test('strict exact repository and build URL; local archive mismatch stops before network',async()=>{assert.throws(()=>packageUrl(0));assert.throws(()=>packageUrl(1,'other/repo'));const f=fixture();f.files[0].data=Buffer.from('changed');await assert.rejects(publishPackage(f),/checksum/);assert.equal(f.events.length,0);});

test('wrong release target and incomplete published package cannot be silently repaired',async()=>{
 const f=fixture();await publishPackage(f);f.release.target_commitish='b'.repeat(40);await assert.rejects(publishPackage(f),/provenance/);
 const g=fixture();await publishPackage(g);g.release.assets.pop();g.events.length=0;await assert.rejects(publishPackage(g),/incomplete/);assert.ok(!g.events.some(e=>e[0]==='upload'));
});

test('colliding actual tag rejects before create/upload despite plausible metadata',async()=>{const f=fixture({tagCollision:true});await assert.rejects(publishPackage(f),/tag points/);assert.ok(!f.events.some(e=>['create','upload','publish'].includes(e[0])));});
test('publish acknowledgement alone cannot hide a draft or changed asset identity',async()=>{for(const opts of [{stuckDraft:true},{swapAfterPublish:true}]){const f=fixture(opts);await assert.rejects(publishPackage(f),/verification failed|assets changed/);}});
test('corrupt existing draft remains unchanged on retry; it is never clobbered',async()=>{const opts={publishFails:true},f=fixture(opts);await assert.rejects(publishPackage(f),/transient/);opts.publishFails=false;opts.corrupt=true;f.events.length=0;await assert.rejects(publishPackage(f),/checksum/);assert.ok(!f.events.some(e=>['upload','publish'].includes(e[0])));assert.equal(f.release.draft,true);});

test('real CLI adapter discovers pending draft by GraphQL ID then REST ID, not REST tag',()=>{
 const calls=[],draft={id:73,draft:true,assets:[]};
 const gh=args=>{calls.push(args);if(args[1]==='graphql')return JSON.stringify({data:{repository:{release:{databaseId:73}}}});assert.deepEqual(args,['api','repos/rnaud/hiraeth/releases/73']);return JSON.stringify(draft);};
 assert.deepEqual(fetchRelease(gh,'rnaud/hiraeth','steam-deck-123001'),draft);assert.equal(calls.length,2);assert.ok(calls[0].includes('tag=steam-deck-123001'));
});
test('adapter distinguishes absent release from API/auth/error response',()=>{
 assert.equal(fetchRelease(()=>JSON.stringify({data:{repository:{release:null}}}),'rnaud/hiraeth','steam-deck-1'),null);
 assert.throws(()=>fetchRelease(()=>{throw Error('HTTP403');},'rnaud/hiraeth','steam-deck-1'),/403/);
 assert.throws(()=>fetchRelease(()=>JSON.stringify({errors:[{message:'permission denied'}],data:{repository:null}}),'rnaud/hiraeth','steam-deck-1'),/lookup/);
});
