import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { eventRange, validateTests, provenBaseline, lastSuccessfulMain } from '../scripts/ci-test-plan.mjs';
import { selectedShard, runSelected } from '../scripts/run-test-shard.mjs';
const NO_GIT_ENV=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
const A='a'.repeat(40), B='b'.repeat(40), C='c'.repeat(40), M='d'.repeat(40);
function fixture(available=[A,B,C,M]) {
 const calls=[];
 const git=(...args)=>{calls.push(args);if(args[0]==='merge-base')return A;const ref=args[2].replace(/\^\{commit\}$/,'');const sha=ref==='HEAD'?M:ref==='refs/remotes/origin/main'?B:ref;if(!available.includes(sha))throw Error('Missing commit');return sha;};
 return {git,calls};
}
test('push selects complete before→after range, including multi-commit pushes',()=>{
 const {git,calls}=fixture();assert.deepEqual(eventRange({eventName:'push',event:{before:A,after:M},head:'HEAD',mainBaseline:{sha:A},git}),{base:A,head:M,full:false});assert.ok(!calls.some(a=>a.some(v => /^HEAD\^(?:[0-9]+)?$/.test(v))));
});
test('PR selects merge-base of real branches through checked-out merge result',()=>{
 const {git,calls}=fixture();assert.deepEqual(eventRange({eventName:'pull_request',event:{pull_request:{base:{sha:B},head:{sha:C}}},head:'HEAD',git}),{base:A,head:M,full:false});assert.ok(calls.some(a=>a.join(' ')==='merge-base '+B+' '+C));
});
test('manual feature uses main merge-base; manual main and scheduled/explicit full enumerate all',()=>{
 const {git}=fixture();assert.equal(eventRange({eventName:'workflow_dispatch',event:{},head:M,git}).base,A);
 assert.equal(eventRange({eventName:'workflow_dispatch',event:{},head:B,git}).full,true);
 for(const eventName of ['schedule','workflow_dispatch','workflow_call'])assert.equal(eventRange({eventName,event:{},head:M,full:true,git}).full,true);
});
test('missing/zero/unproven base selects full; inconsistent checkout and unknown events fail',()=>{
 const {git}=fixture();for(const before of [undefined,'0'.repeat(40),'e'.repeat(40)])assert.equal(eventRange({eventName:'push',event:{before,after:M},head:M,mainBaseline:{sha:A},git}).full,true);
 assert.throws(()=>eventRange({eventName:'push',event:{before:A,after:B},head:M,git}));
 assert.throws(()=>eventRange({eventName:'unknown',event:{},head:M,git}));
});
test('balanced shards partition only the explicit selection, with empty shards safe',()=>{
 const all=['tests/a.test.js','tests/b.test.js','tests/c.test.js'], selected=all.slice(0,2), times={[all[0]]:10,[all[1]]:3,[all[2]]:99};
 const shards=Array.from({length:4},(_,i)=>selectedShard(selected,all,times,`${i+1}/4`));assert.deepEqual(shards.flat().sort(),selected);assert.equal(shards.filter(x=>!x.length).length,2);
 let invoked=false;assert.equal(runSelected([],[],()=>{invoked=true;}),0);assert.equal(invoked,false);
 let actual;assert.equal(runSelected(selected,['--test-reporter=spec'],(exe,args)=>{actual=args;return{status:1};}),1);assert.deepEqual(actual.slice(-2),selected);
});
test('malformed, stale, duplicate or absent lists cannot silently select all',()=>{
 for(const value of [null,'ALL',['tests/missing.test.js'],['tests/a.test.js','tests/a.test.js']])assert.throws(()=>validateTests(value,['tests/a.test.js']));
 assert.throws(()=>selectedShard([],[],{},'0/4'));assert.throws(()=>selectedShard([],[],{},'1/0'));
});
test('workflow preserves five named shards, explicit lists and separate daily tool coverage',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const ci=read('.github/workflows/tests.yml'),night=read('.github/workflows/nightly-tests.yml');
 assert.match(ci,/^name: Tests\n/);assert.match(ci,/name: unit \(shard \$\{\{ matrix.shard \}\}\/5\)/);assert.match(ci,/shard: \[1, 2, 3, 4, 5\]/);assert.match(ci,/run-test-shard\.mjs \$\{\{ matrix.shard \}\}\/5/);assert.match(ci,/needs: selection/);assert.match(ci,/fetch-depth: 0/);assert.match(ci,/SELECTED_TESTS: \$\{\{ needs.selection.outputs.files \}\}/);assert.match(ci,/ref: \$\{\{ needs.selection.outputs.head \}\}/);
 assert.match(night,/uses: \.\/\.github\/workflows\/tests.yml\n    with:\n      full: true/);assert.match(night,/node --test tests\/nightly\/\*\.test.js/);
 for(const file of ['deploy.yml','cloudflare.yml']){const y=read('.github/workflows/'+file);assert.match(y,/workflow_run.event == 'push'/);assert.match(y,/workflow_run.head_branch == 'main'/);assert.match(y,/workflow_run.head_repository.full_name == github.repository/);}
});

test('real Git divergent feature uses merge-base and push covers both new commits',()=>{
 const dir=tempDir('hiraeth-ci-range-');
 const git=(...args)=>execFileSync('git',args,{cwd:dir,env:NO_GIT_ENV,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try {
  git('init','-q','-b','fixture-feature');git('config','user.email','fixture@example.invalid');git('config','user.name','CI fixture');
  const commit=(name)=>{writeFileSync(join(dir,name),name);git('add',name);git('commit','-qm',name);return git('rev-parse','HEAD');};
  const base=commit('initial');git('branch','main');const one=commit('feature-one'),two=commit('feature-two');
  git('checkout','-q','main');const main=commit('main-change');git('update-ref','refs/remotes/origin/main',main);git('checkout','-q','--detach',two);
  assert.deepEqual(eventRange({eventName:'workflow_dispatch',event:{},head:'HEAD',git}),{head:two,base,full:false});
  assert.deepEqual(eventRange({eventName:'push',event:{before:base,after:two},head:'HEAD',mainBaseline:{sha:base},git}),{head:two,base,full:false});
  assert.notEqual(one,base);assert.equal(eventRange({eventName:'push',event:{before:'f'.repeat(40),after:two},head:'HEAD',mainBaseline:{sha:base},git}).full,true);
  assert.deepEqual(eventRange({eventName:'push',event:{before:one,after:two},head:'HEAD',mainBaseline:{sha:base},git}),{head:two,base,full:false},'canceled or failed first push must remain in second push selection');
 } finally {removeTemp(dir);}
});

test('only successful same-repository main push ancestors qualify, never canceled/failed/manual',()=>{
 const good={id:1,name:'Tests',path:'.github/workflows/tests.yml',event:'push',head_branch:'main',conclusion:'success',status:'completed',head_repository:{full_name:'owner/repo'},head_sha:A};
 const {git}=fixture();const context={repository:'owner/repo',head:M,runId:99,git};
 const invalid=[{conclusion:'cancelled'},{conclusion:'failure'},{event:'workflow_dispatch'},{event:'schedule'},{head_branch:'feature'},{head_repository:{full_name:'fork/repo'}},{path:'.github/workflows/other.yml'},{id:99}].map(x=>({...good,...x}));
 assert.equal(provenBaseline(invalid,context),null);assert.equal(provenBaseline([...invalid,good],context).sha,A);
 assert.equal(provenBaseline([good],{...context,git:()=>{throw Error('not ancestor')}}),null);
});
test('baseline API outage or no green history yields full; pagination retains older proof',async()=>{
 const {git}=fixture();const context={repository:'owner/repo',head:M,runId:99,git,token:'fixture-only'};
 assert.equal(await lastSuccessfulMain({...context,request:async()=>{throw Error('offline')}}),null);
 assert.equal(await lastSuccessfulMain({...context,request:async()=>({ok:false})}),null);
 let calls=0;const request=async()=>({ok:true,json:async()=>({workflow_runs:++calls===1?Array.from({length:100},()=>({conclusion:'cancelled'})):[{id:1,name:'Tests',path:'.github/workflows/tests.yml',event:'push',head_branch:'main',conclusion:'success',status:'completed',head_repository:{full_name:'owner/repo'},head_sha:A}]})});
 assert.equal((await lastSuccessfulMain({...context,request})).sha,A);assert.equal(calls,2);
 assert.equal(eventRange({eventName:'push',event:{before:B,after:M},head:M,mainBaseline:null,git}).full,true);
});

test('reusable full-suite callers grant the history-read permission required by Tests', () => {
  for (const name of ['nightly-tests.yml', 'xbox.yml']) {
    const yaml = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.match(yaml, /permissions:\n(?:  [^\n]+\n)*  actions: read/);
  }
});

test('daily coverage includes Python installer tests as well as gameplay and tool suites', () => {
  const yaml = readFileSync(new URL('../.github/workflows/nightly-tests.yml', import.meta.url), 'utf8');
  assert.match(yaml, /python3 -m unittest discover -s tests -p 'test_\*.py'/);
});
