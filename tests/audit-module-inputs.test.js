import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {parseAst} from 'rolldown/parseAst';

function catalog(source,prefix){
 const ast=parseAst(source);
 const declaration=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(d=>d.id.name==='loaders');
 assert.equal(declaration?.init.type,'ObjectExpression');
 return declaration.init.properties.map(p=>{
  assert.equal(p.type,'Property');assert.equal(p.computed,false);
  const name=p.key.value;assert.equal(typeof name,'string');
  assert.equal(p.value.type,'ArrowFunctionExpression');assert.equal(p.value.params.length,0);
  assert.equal(p.value.body.type,'ImportExpression');assert.equal(p.value.body.source.type,'Literal');
  assert.equal(p.value.body.source.value,prefix+name,'key and actual import must agree');
  return name;
 });
}
const minigames=readFileSync(new URL('./minigame-modules.js',import.meta.url),'utf8');
const stories=readFileSync(new URL('./story-data-modules.js',import.meta.url),'utf8');
test('literal audit catalogs cover exactly the original discovery sets',()=>{
 assert.deepEqual(catalog(minigames,'../src/minigames/'),readdirSync(new URL('../src/minigames/',import.meta.url)).filter(f=>f.endsWith('.js')&&f!=='index.js').sort());
 assert.deepEqual(catalog(stories,'../src/story/'),readdirSync(new URL('../src/story/',import.meta.url)).filter(f=>f.endsWith('-data.js')).sort());
});
test('catalog contract detects additions, omissions, duplicates and misdirected imports',()=>{
 const names=catalog(minigames,'../src/minigames/');
 for(const changed of [[...names,'new-game.js'],names.slice(1),[...names,names[0]]])assert.throws(()=>assert.deepEqual(names,changed));
 assert.throws(()=>catalog(minigames.replace('../src/minigames/','../src/other/'),'../src/minigames/'));
});

test('fight-only imports cover both original fight discovery sets',()=>{
 const source=readFileSync(new URL('./fight-modules.js',import.meta.url),'utf8');
 const actual=readdirSync(new URL('../src/minigames/',import.meta.url));
 const names=catalog(source,'../src/minigames/');
 assert.deepEqual(names,actual.filter(f=>/^fight-.*\.js$/.test(f)).sort());
 assert.deepEqual(names,actual.filter(f=>/^fight-\w+\.js$/.test(f)).sort());
});
