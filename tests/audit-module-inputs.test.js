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


test('guardian and costume catalogs retain the complete original filesystem discovery', async()=>{
 const templeSource=readFileSync(new URL('./temple-modules.js',import.meta.url),'utf8');
 const templeNames=catalog(templeSource,'../src/temples/');
 assert.deepEqual(templeNames,readdirSync(new URL('../src/temples/',import.meta.url)).filter(f=>f.endsWith('.js')&&!/-data|boss|hints|index|kit|logic|migrate|pieces|runtime|guardian/.test(f)).sort());
 const {templeSources}=await import('./temple-modules.js');
 const sources=templeSources();
 assert.deepEqual([...sources.keys()],templeNames,'source scan and executable imports cover the same temples');
 for(const file of templeNames)assert.equal(sources.get(file),readFileSync(new URL('../src/temples/'+file,import.meta.url),'utf8'));
 const people=catalog(readFileSync(new URL('../scripts/costume-people.mjs',import.meta.url),'utf8'),'../src/');
 const discovered=[];
 for(const dir of ['story','temples'])for(const file of readdirSync(new URL('../src/'+dir+'/',import.meta.url)).sort()){
  if(/-(data|people)\.js$/.test(file)&&!['aliens-data.js','hosts-data.js','shop-data.js','fellow-data.js','scientist-data.js','home-data.js','lantern-data.js'].includes(file))discovered.push(dir+'/'+file);
 }
 assert.deepEqual(people,discovered);
});


test('story catalogue file lookup retains the module namespace and rejects unknown names',async()=>{
 const {loadStoryFile,loadStoryData}=await import('./story-data-modules.js');
 assert.equal(await loadStoryFile('desert-data.js'),await loadStoryData('desert'));
 assert.throws(()=>loadStoryFile('../desert-data.js'),/Unknown story data/);
 assert.throws(()=>loadStoryFile('missing-data.js'),/Unknown story data/);
});
