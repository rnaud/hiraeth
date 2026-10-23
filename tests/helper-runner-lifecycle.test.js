// Exercise the actual shared runner class without its browser-only CSS import.
// Recovery must not touch a DOM, audio object, game session or intro card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/minigames/kit/runner.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace(/^export \{.*;\n/gm,'').replace(/^export /gm,'');
const Runner=vm.runInNewContext(source+'\nMinigameRunner;', {NO_INPUT:{},readInput:()=>({})});

test('receipt recovery creates no session or card, navigates once and never publishes',()=>{
 let starts=0,cards=0,navigations=0;
 const previous=Runner.prototype.buildDom;Runner.prototype.buildDom=()=>{cards++;throw Error('Recovery cannot build DOM');};
 try {
  const r=new Runner({start(){starts++;throw Error('Recovery cannot start game');}}, {recoveryHref:()=>'?level=desert',navigate:()=>navigations++});
  r.publish=()=>{throw Error('No publish after navigation');};
  assert.equal(r.busy(),true);assert.equal(r.cardEl(),null);
  r.update(.1,{});r.update(.1,{});r.go('?level=desert');
  assert.equal(starts,0);assert.equal(cards,0);assert.equal(navigations,1);assert.equal(r.ended,true);
 } finally {Runner.prototype.buildDom=previous;}
});
test('invalidated recovery remains inert and cannot retry into gameplay',()=>{
 let valid=true,starts=0,navigations=0;
 const r=new Runner({start(){starts++;}}, {recoveryHref:()=>valid?'?level=arzach':null,navigate:()=>navigations++});
 valid=false;r.update(1,{});r.retry();r.finish({goal:{game:'elderflight',complete:true}});
 assert.equal(starts,0);assert.equal(navigations,0);assert.equal(r.phase,'recovering');
});
test('successful finish waits for the boundary, then no HUD is published after go',()=>{
 const r=Object.create(Runner.prototype);let navigation=0,published=0;
 Object.assign(r,{phase:'finishing',doneT:1.7,result:{goal:{game:'cistern',complete:true}},session:{update(){}},host:{completionHref:()=>'?level=desert'},drawHud(){},publish(){published++;},go(){navigation++;this.ended=true;}});
 r.update(1,{});assert.equal(navigation,0);assert.equal(published,1);
 r.update(.8,{});assert.equal(navigation,1);assert.equal(published,1);
 r.update(1,{});assert.equal(navigation,1);
});
test('late finish after end cannot persist a result or reward',()=>{
 const r=Object.create(Runner.prototype);Object.assign(r,{ended:true,phase:'play',host:{onResult(){throw Error('Late receipt');}}});
 r.finish({goal:{game:'cistern',complete:true}});assert.equal(r.result,undefined);
});
